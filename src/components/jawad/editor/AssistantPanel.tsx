"use client";

import { useEffect, useRef, useState } from "react";
import { clipEnd, findClip, type Timeline } from "@/lib/editor/model";
import { framesOf } from "./media";
import type { Command } from "@/lib/editor/commands";
import { postJson } from "@/lib/fetch";
import Icon from "../Icon";
import type { Run } from "./Inspector";
import { PEAK_RATE, peaksOf } from "./peaks";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

interface Msg {
  role: "user" | "assistant";
  text: string;
  done?: number;
  suggestions?: { prompt: string; why: string }[];
  error?: boolean;
}

const QUICK = ["قص السكتات الطويلة", "رتّب المقاطع وحط انتقالات ناعمة", "خلّه ٣٠ ثانية بأحلى اللقطات", "حط عنوان في البداية", "سوّ لي مونتاج كامل من الملفات", "خفّض الموسيقى وقت الكلام"];

/**
 * The silent parts of the clips that have sound (timeline ms), from the files' loudness: Claude uses them for
 * «قص السكتات». A part counts when it stays under a quarter of the clip's usual level for half a second or more.
 */
async function quietParts(tl: Timeline, assets: Map<string, EditorAsset>) {
  const out: { clipId: string; ranges: [number, number][] }[] = [];
  for (const track of tl.tracks) {
    if (track.muted || track.kind === "text") continue;
    for (const c of track.clips) {
      const a = c.assetId ? assets.get(c.assetId) : null;
      if (!a || a.kind === "image" || !a.hasAudio || !a.url) continue;
      const peaks = await peaksOf(a.id, a.url);
      if (!peaks) continue;
      const from = Math.floor((c.in / 1000) * PEAK_RATE);
      const to = Math.min(peaks.length, Math.ceil((c.out / 1000) * PEAK_RATE));
      const part = Array.from(peaks.subarray(from, to)).sort((x, y) => x - y);
      const usual = part[Math.floor(part.length * 0.6)] ?? 0;
      const limit = Math.max(6, usual * 0.25);
      const ranges: [number, number][] = [];
      let start = -1;
      for (let k = from; k <= to; k++) {
        const quiet = k < to && peaks[k] <= limit;
        if (quiet && start < 0) start = k;
        if (!quiet && start >= 0) {
          if (k - start >= PEAK_RATE / 2) {
            const s = ((start / PEAK_RATE) * 1000 - c.in) / c.speed + c.start;
            const e = ((k / PEAK_RATE) * 1000 - c.in) / c.speed + c.start;
            ranges.push([Math.round(s), Math.round(Math.min(e, clipEnd(c)))]);
          }
          start = -1;
        }
      }
      if (ranges.length) out.push({ clipId: c.id, ranges: ranges.slice(0, 100) });
    }
  }
  return out;
}

/** «✨ Claude»: say what you want; Claude edits the timeline (one change, undoable). */
export default function AssistantPanel({
  ask,
  projectId,
  tl,
  selected,
  assets,
  player,
  run,
  onUndo,
  onClose,
  readOnly,
}: {
  /** a request sent from a button (sent once per `n`) */
  ask?: { text: string; n: number } | null;
  projectId: string;
  tl: Timeline;
  selected: string[];
  assets: Map<string, EditorAsset>;
  player: PlayerLike | null;
  run: Run;
  onUndo: () => void;
  onClose?: () => void;
  readOnly: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs, busy]);

  const sent = useRef(0);
  // pictures of clips already looked at (kept while the clip's part stays the same)
  const seenFrames = useRef(new Map<string, { t: number; data: string }[]>());
  const lookAt = async () => {
    if (selected.length !== 1) return null;
    const f = findClip(tl, selected[0]);
    const a = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
    if (!f || !a?.url || a.kind === "audio" || f.track.kind === "audio") return null;
    const c = f.clip;
    const key = `${c.id}:${c.in}:${c.out}:${c.start}`;
    let frames = seenFrames.current.get(key);
    if (!frames) {
      setBusy("Claude يشوف المقطع المحدد…");
      try {
        const n = a.kind === "image" ? 1 : Math.min(6, Math.max(2, Math.round((c.out - c.in) / 2000)));
        const src = await framesOf(a.url, a.kind, c.in, c.out, n);
        // the moments on the timeline (what the person sees)
        frames = src.map((x) => ({ t: Math.round(c.start + (x.t - c.in) / c.speed), data: x.data }));
        seenFrames.current.set(key, frames);
      } catch {
        return null;
      }
    }
    return { clipId: c.id, frames };
  };
  const send = async (words = text) => {
    const message = words.trim();
    if (!message || busy || readOnly) return;
    setText("");
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: message }]);
    try {
      setBusy("نسمع الصوت ونلقى السكتات…");
      const quiet = await quietParts(tl, assets);
      // the clip the person chose: Claude looks at a few of its moments to know what is in it
      const look = await lookAt();
      setBusy("Claude يشتغل على التايملاين…");
      const r = await postJson<{ reply: string; commands: Command[]; suggestions: { prompt: string; why: string }[] }>(`/api/jawad/editor/projects/${projectId}`, {
        action: "assistant",
        message,
        history,
        timeline: tl,
        playhead: player?.ms ?? 0,
        selected,
        quiet,
        look,
      });
      let done = 0;
      if (r.commands.length) {
        const applied = run(r.commands, { label: `Claude: ${message.slice(0, 40)}` });
        done = applied ? r.commands.length : 0;
      }
      setMsgs((m) => [...m, { role: "assistant", text: r.reply, done, suggestions: r.suggestions }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => {
    if (!ask || ask.n === sent.current || busy) return;
    const t = setTimeout(() => {
      // marked as sent only when it really goes (a render in between cancels the wait, not the request)
      sent.current = ask.n;
      void send(ask.text);
    }, 0);
    return () => clearTimeout(t);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2.5 border-b border-jw-line px-3 py-2.5">
        <span className="jw-orb h-9 w-9 shrink-0" data-busy={!!busy} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Claude · مساعدك في المونتاج</span>
          <span className="flex items-center gap-1 text-[11px] text-jw-muted" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-jw-warn" : "bg-jw-ok"}`} />
            {busy ? "يشتغل…" : "جاهز يخدمك"}
          </span>
        </span>
        {onClose && (
          <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="إغلاق">
            <Icon name="x" />
          </button>
        )}
      </div>
      <div className="jw-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {!msgs.length && (
          <div className="space-y-3">
            <div className="max-w-[92%] rounded-2xl rounded-ss-sm bg-jw-surface-2 px-3 py-2 text-sm leading-6">
              هلا! أنا مساعدك في المونتاج 👋
              <span className="mt-1 block text-xs leading-6 text-jw-muted">قل لي وش تبي بكلامك وأنا أعدّل التايملاين: أقص السكتات، أرتّب، أحط انتقالات ونصوص وكابشن، وأنظّف الصوت. كل اللي أسويه تتراجع عنه بضغطة.</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button key={q} type="button" disabled={readOnly || !!busy} className="jw-chip !px-2.5 !py-1 !text-xs" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm leading-6 ${m.role === "user" ? "ms-auto bg-jw-accent/15" : m.error ? "bg-jw-danger/15 text-jw-danger" : "bg-jw-surface-2"}`} dir="auto">
            <p className="whitespace-pre-wrap">{m.text}</p>
            {m.done ? (
              <p className="mt-1.5 flex items-center gap-2 text-[11px] text-jw-ok">
                <Icon name="check" size={12} /> نفّذت {m.done === 1 ? "خطوة وحدة" : m.done === 2 ? "خطوتين" : `${m.done} خطوات`}
                {i === msgs.length - 1 && (
                  <button type="button" className="text-jw-muted underline" onClick={onUndo}>
                    تراجع
                  </button>
                )}
              </p>
            ) : null}
            {m.suggestions?.length ? (
              <div className="mt-2 space-y-1.5 border-t border-jw-line pt-2">
                <p className="text-[11px] text-jw-muted">لقطات تكمّل الفيديو:</p>
                {m.suggestions.map((s) => (
                  <a key={s.prompt} href={`/jawad-ai?kind=video&idea=${encodeURIComponent(s.prompt.slice(0, 500))}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-jw-line p-2 text-xs hover:border-jw-accent">
                    🎬 {s.why}
                    <span className="block text-[10px] text-jw-faint" dir="ltr">{s.prompt}</span>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-xs text-jw-muted">
            <span className="jw-spinner" /> {busy}
          </p>
        )}
        <div ref={end} />
      </div>
      {(() => {
        const f = selected.length === 1 ? findClip(tl, selected[0]) : null;
        const as = f?.clip.assetId ? assets.get(f.clip.assetId) : null;
        return as && as.kind !== "audio" && f!.track.kind !== "audio" ? (
          <p className="flex items-center gap-1.5 border-t border-jw-line px-3 pt-1.5 text-[11px] text-jw-muted">
            <Icon name="eye" size={13} className="text-jw-accent" /> Claude بيشوف المقطع المحدد «{as.name}» مع رسالتك
          </p>
        ) : null;
      })()}
      <form
        className="flex items-end gap-2 border-t border-jw-line p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          className="jw-textarea max-h-32 min-h-11 flex-1 resize-none text-sm"
          rows={1}
          dir="auto"
          value={text}
          disabled={readOnly}
          placeholder="مثلًا: قص السكتات وحط كابشن"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="jw-btn jw-btn-primary jw-btn-icon shrink-0" disabled={!text.trim() || !!busy || readOnly} aria-label="أرسل">
          <Icon name="chevronLeft" />
        </button>
      </form>
    </div>
  );
}
