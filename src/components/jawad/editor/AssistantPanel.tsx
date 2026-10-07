"use client";

import { useEffect, useRef, useState } from "react";
import { clipEnd, findClip, type Timeline } from "@/lib/editor/model";
import { framesOf } from "./media";
import { diagReport, previewShot } from "./diag";
import { gradeLayers } from "./grade-gl";
import type { Grade } from "@/lib/editor/grade";
import { makeHookAsset, makeMusicAsset, makeSfxAsset } from "./make";
import { startMaking } from "./making";
import type { MakePlan } from "@/lib/editor/make-any";
import { placeHookDesign, placeMusic } from "@/lib/editor/make";
import { hookAspect } from "@/lib/editor/hook-design";
import type { MakeRequest } from "@/lib/editor/assistant";
import type { Chat } from "@/lib/editor/chat";
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
  /** «اصنع لي…» that cost coins: shown with their price, started by a tap */
  plans?: { plan: MakePlan; state: "ask" | "started" | "failed" }[];
  error?: boolean;
}

/** From here a handoff is suggested (same as the server's CHAT_LONG). */
const LONG = { messages: 40, chars: 24_000 };
const localKey = (id: string) => `jw-editor-chat-${id}`;

const QUICK = ["صمّم لي نص هوك", "حط موسيقى تناسب المقطع", "قص السكتات الطويلة", "رتّب المقاطع وحط انتقالات ناعمة", "خلّه ٣٠ ثانية بأحلى اللقطات", "حط عنوان في البداية", "سوّ لي مونتاج كامل من الملفات", "خفّض الموسيقى وقت الكلام"];

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
  onAssets,
  onSeparate,
  onSceneCut,
  projectId,
  tl,
  selected,
  assets,
  player,
  run,
  onUndo,
  onClose,
  readOnly,
  big,
  onBig,
  zoom,
  onZoom,
  diag,
}: {
  /** a request sent from a button (sent once per `n`) */
  ask?: { text: string; n: number } | null;
  /** new library files (made for the edit) */
  onAssets: (a: EditorAsset[]) => void;
  /** splits a clip's sound into talking / music / effects tracks */
  onSeparate: (clipId: string) => Promise<void>;
  /** cuts a video clip at every change of shot */
  onSceneCut: (clipId: string) => Promise<number>;
  projectId: string;
  tl: Timeline;
  selected: string[];
  assets: Map<string, EditorAsset>;
  player: PlayerLike | null;
  run: Run;
  onUndo: () => void;
  onClose?: () => void;
  readOnly: boolean;
  /** the conversation over the whole editor (a computer) */
  big?: boolean;
  onBig?: () => void;
  /** its text size (1 = normal) */
  zoom?: number;
  onZoom?: (z: number) => void;
  /** the site's owner: «🩺 تشخيص» (the editor's state, read when asked) */
  diag?: () => Record<string, unknown>;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // «🩺 تشخيص»: the next message asks حيدرة to find what went wrong (the owner only)
  const [diagOn, setDiagOn] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [msgs, busy]);

  // ---------- the edit's conversation stays with the project (server; before the migration, this device) ----------
  const [chat, setChat] = useState<{ loaded: boolean; stored: boolean; handoff: string | null; chats: number }>({ loaded: false, stored: false, handoff: null, chats: 1 });
  const [showHandoff, setShowHandoff] = useState(false);
  useEffect(() => {
    let live = true;
    postJson<Chat>(`/api/jawad/editor/projects/${projectId}`, { action: "chat" })
      .catch(() => ({ messages: [], handoff: null, chats: 1, stored: false }) as Chat)
      .then((c) => {
        if (!live) return;
        let saved: { msgs: Msg[]; handoff: string | null; chats: number } = { msgs: c.messages, handoff: c.handoff, chats: c.chats };
        if (!c.stored) {
          try {
            const raw = JSON.parse(localStorage.getItem(localKey(projectId)) ?? "null");
            if (raw && Array.isArray(raw.msgs)) saved = { msgs: raw.msgs, handoff: raw.handoff ?? null, chats: Number(raw.chats) || 1 };
          } catch {
            /* nothing kept */
          }
        }
        // anything said while it was loading stays after what was kept
        setMsgs((now) => [...saved.msgs, ...now]);
        setChat({ loaded: true, stored: c.stored, handoff: saved.handoff, chats: saved.chats });
      });
    return () => {
      live = false;
    };
  }, [projectId]);
  useEffect(() => {
    if (!chat.loaded || chat.stored) return;
    try {
      localStorage.setItem(localKey(projectId), JSON.stringify({ msgs: msgs.filter((m) => !m.error).slice(-200).map((m) => ({ role: m.role, text: m.text, done: m.done })), handoff: chat.handoff, chats: chat.chats }));
    } catch {
      /* not kept */
    }
  }, [msgs, chat, projectId]);
  const long = msgs.length >= LONG.messages || msgs.reduce((n, m) => n + m.text.length, 0) >= LONG.chars;
  const handOff = async () => {
    if (busy || !msgs.length) return;
    setBusy("حيدرة يكتب الهاندوف ويبدأ محادثة جديدة…");
    try {
      const c = await postJson<Chat>(`/api/jawad/editor/projects/${projectId}`, { action: "handoff", messages: msgs.filter((m) => !m.error), handoff: chat.handoff });
      setMsgs([]);
      setChat((x) => ({ ...x, handoff: c.handoff, chats: c.chats }));
      setShowHandoff(true);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
    } finally {
      setBusy(null);
    }
  };

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
      setBusy("حيدرة يشوف المقطع المحدد…");
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
    // graded clips: the same moments after its colour grading too (what the person sees), to judge the grade
    const graded = c.grades.some((g) => g.on) ? await gradedFrames(frames.slice(0, 4), c.grades, (t) => Math.max(0, (t - c.start) * c.speed)).catch(() => []) : [];
    return { clipId: c.id, frames: [...frames.slice(0, graded.length ? 4 : 8), ...graded] };
  };
  const send = async (words = text) => {
    const message = words.trim();
    if (!message || busy || readOnly) return;
    setText("");
    const history = msgs.filter((m) => !m.error).map((m) => ({ role: m.role, text: m.text }));
    setMsgs((m) => [...m, { role: "user", text: diag && diagOn ? `🩺 ${message}` : message }]);
    if (diag && diagOn) {
      try {
        setBusy("حيدرة يفحص المحرر والملفات والسجل…");
        const report = await diagReport(diag());
        const r = await postJson<{ reply: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "diagnose", message, report, timeline: tl, selected, playhead: player?.ms ?? 0, shot: previewShot() });
        setMsgs((m) => [...m, { role: "assistant", text: r.reply }]);
      } catch (e) {
        setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
      } finally {
        setBusy(null);
      }
      return;
    }
    try {
      setBusy("نسمع الصوت ونلقى السكتات…");
      const quiet = await quietParts(tl, assets);
      // the clip the person chose: Claude looks at a few of its moments to know what is in it
      const look = await lookAt();
      setBusy("حيدرة يشتغل على التايملاين…");
      const r = await postJson<{ reply: string; commands: Command[]; suggestions: { prompt: string; why: string }[]; requests?: MakeRequest[] }>(`/api/jawad/editor/projects/${projectId}`, {
        action: "assistant",
        message,
        history,
        handoff: chat.handoff,
        timeline: tl,
        playhead: player?.ms ?? 0,
        selected,
        quiet,
        look,
      });
      let done = 0;
      if (r.commands.length) {
        const applied = run(r.commands, { label: `حيدرة: ${message.slice(0, 40)}` });
        done = applied ? r.commands.length : 0;
      }
      setMsgs((m) => [...m, { role: "assistant", text: r.reply, done, suggestions: r.suggestions }]);
      // what Claude asked to be made: made one by one, then placed (each its own undo)
      for (const q of r.requests ?? []) {
        try {
          if (q.kind === "hook_design" && q.design) {
            // «نص الهوك»: the picture, then the two sounds, then everything placed and timed (one undo)
            const d = q.design;
            setBusy(`نصنع صورة الهوك «${q.text}»…`);
            const img = await makeHookAsset(projectId, q.text, "", { prompt: d.imagePrompt, background: d.background, aspect: hookAspect(d, q.orientation ?? "vertical") });
            onAssets([img]);
            setBusy("نصنع مؤثر الدخول والخروج…");
            const sfx = await Promise.all(
              [d.sfxIn, d.sfxOut].map((x, i) => makeSfxAsset(projectId, x.prompt, x.seconds, `${i ? "خروج" : "دخول"} الهوك · ${q.text}`).catch(() => null)),
            );
            onAssets(sfx.filter((a): a is EditorAsset => !!a));
            run(placeHookDesign(d, { image: img.id, sfxIn: sfx[0]?.id ?? null, sfxOut: sfx[1]?.id ?? null }, q.at, q.orientation ?? "vertical"), { label: `نص الهوك: ${q.text.slice(0, 30)}` });
            if (sfx.some((a) => !a)) setMsgs((m) => [...m, { role: "assistant", text: "ما قدرت أصنع أحد المؤثرين الصوتيين؛ الهوك انحط بدونه، وأمره مكتوب فوق.", error: true }]);
          } else if (q.kind === "music") {
            setBusy("نصنع الموسيقى…");
            const a = await makeMusicAsset(projectId, q.prompt, q.lengthMs || 30_000);
            onAssets([a]);
            run(placeMusic(a.id, q.at), { label: "موسيقى" });
          } else if (q.kind === "make" && q.plan) {
            const plan = q.plan;
            if (plan.free) {
              setBusy(`أبدأ أصنع «${plan.name}»…`);
              await startMaking(projectId, plan);
              setMsgs((m) => [...m, { role: "assistant", text: `بدأت أصنع «${plan.name}» بـ ${plan.generatorName}${plan.kind === "video" ? " (الفيديو ياخذ كم دقيقة)" : ""}؛ ينحط على التايملاين لحاله أول ما يخلص.` }]);
            } else {
              setMsgs((m) => [...m, { role: "assistant", text: `جاهز أصنع «${plan.name}» بـ ${plan.generatorName}.`, plans: [{ plan, state: "ask" }] }]);
            }
          } else if (q.kind === "separate") {
            setBusy("نفصل الكلام والموسيقى والمؤثرات…");
            await onSeparate(q.clipId);
          } else if (q.kind === "scene_cut") {
            setBusy("أقرأ المشاهد وأقطّع عند كل تغيّر…");
            await onSceneCut(q.clipId);
          }
        } catch (e) {
          setMsgs((m) => [...m, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
        }
      }
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
          <span className="block truncate text-sm font-bold">حيدرة · مساعدك في المونتاج</span>
          <span className="flex items-center gap-1 text-[11px] text-jw-muted" aria-live="polite">
            <span className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-jw-warn" : "bg-jw-ok"}`} />
            {busy ? "يشتغل…" : "جاهز يخدمك"}
          </span>
        </span>
        {msgs.length > 0 && (
          <button type="button" className={`jw-btn !min-h-8 !px-2 text-[11px] ${long ? "!border-jw-accent/60 text-jw-accent" : "jw-btn-quiet"}`} disabled={!!busy || readOnly} onClick={handOff} title="حيدرة يلخّص المحادثة (هاندوف) ويبدأ محادثة جديدة منها">
            <Icon name="retry" size={13} /> محادثة جديدة
          </button>
        )}
        {onZoom && zoom != null && (
          <span className="flex items-center rounded-full border border-jw-line" role="group" aria-label="حجم الكلام">
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={zoom <= 0.85} onClick={() => onZoom(Math.round((zoom - 0.15) * 100) / 100)} aria-label="صغّر الكلام" title="صغّر الكلام">
              <Icon name="zoomOut" size={15} />
            </button>
            <button type="button" className="grid h-8 w-8 place-items-center rounded-full text-jw-muted hover:text-jw-ink disabled:opacity-40" disabled={zoom >= 1.6} onClick={() => onZoom(Math.round((zoom + 0.15) * 100) / 100)} aria-label="كبّر الكلام" title="كبّر الكلام">
              <Icon name="zoomIn" size={15} />
            </button>
          </span>
        )}
        {onBig && (
          <span className="hidden lg:contents">
            <button type="button" className={`jw-btn !min-h-8 !px-2 text-[11px] ${big ? "!border-jw-accent/60 text-jw-accent" : "jw-btn-quiet"}`} onClick={onBig} aria-pressed={!!big} title={big ? "رجّع المحادثة لمكانها (Esc)" : "كبّر المحادثة على الشاشة كلها"}>
              <Icon name={big ? "shrink" : "expand"} size={14} /> {big ? "تصغير" : "تكبير"}
            </button>
          </span>
        )}
        {onClose && (
          <>
            {/* a phone: the conversation fills the screen, and this brings the timeline back */}
            <span className="contents lg:hidden">
              <button type="button" className="jw-btn jw-btn-primary !min-h-9 !px-3 text-xs" onClick={onClose} aria-label="صغّر المحادثة وارجع للتايملاين">
                <Icon name="shrink" size={15} /> تصغير
              </button>
            </span>
            <span className="hidden lg:contents">
              <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" onClick={onClose} aria-label="إغلاق">
                <Icon name="x" />
              </button>
            </span>
          </>
        )}
      </div>
      <div className="jw-scroll min-h-0 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
        {chat.handoff && (
          <div className="rounded-xl border border-jw-accent/30 bg-jw-accent/5 p-2.5 text-xs">
            <button type="button" className="flex w-full items-center gap-1.5 font-semibold text-jw-accent" onClick={() => setShowHandoff((v) => !v)} aria-expanded={showHandoff}>
              <Icon name="check" size={12} /> المحادثة {chat.chats} · تبدأ من هاندوف اللي قبلها
              <span className="ms-auto text-jw-muted">{showHandoff ? "إخفاء" : "عرض"}</span>
            </button>
            {showHandoff && <p className="mt-2 whitespace-pre-wrap leading-6 text-jw-muted" dir="auto">{chat.handoff}</p>}
          </div>
        )}
        {!msgs.length && chat.loaded && (
          <div className="space-y-3">
            <div className="max-w-[92%] rounded-2xl rounded-ss-sm bg-jw-surface-2 px-3 py-2 text-sm leading-6">
              هلا! أنا حيدرة، مساعدك في المونتاج 👋
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
            <MsgText text={m.text} />
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
            {m.plans?.map((x, k) => (
              <div key={k} className="mt-2 rounded-lg border border-jw-line p-2 text-xs">
                <p className="text-jw-muted" dir="auto">{x.plan.prompt.slice(0, 200)}</p>
                {x.state === "ask" ? (
                  <button
                    type="button"
                    className="jw-btn jw-btn-primary mt-2 !min-h-8 w-full text-xs"
                    disabled={readOnly || !!busy}
                    onClick={async () => {
                      const mark = (state: "started" | "failed") => setMsgs((all) => all.map((mm, j) => (j === i ? { ...mm, plans: mm.plans?.map((pp, kk) => (kk === k ? { ...pp, state } : pp)) } : mm)));
                      try {
                        await startMaking(projectId, x.plan);
                        mark("started");
                      } catch (e) {
                        mark("failed");
                        setMsgs((all) => [...all, { role: "assistant", text: e instanceof Error ? e.message : "تعذّر.", error: true }]);
                      }
                    }}
                  >
                    اصنعه ({x.plan.coins} نقدة)
                  </button>
                ) : (
                  <p className="mt-1.5 text-[11px] text-jw-ok">{x.state === "started" ? "بدأ الصنع ✓ ينحط على التايملاين لحاله" : "ما بدأ"}</p>
                )}
              </div>
            ))}
          </div>
        ))}
        {long && !busy && (
          <div className="rounded-xl border border-jw-warn/40 bg-jw-warn/10 p-2.5 text-xs">
            المحادثة طوّلت. خلّ حيدرة يكتب هاندوف لكل اللي اتفقنا عليه ويبدأ محادثة جديدة منه — يتذكّر ذوقك وقراراتك ويرد أسرع.
            <button type="button" className="jw-btn jw-btn-primary mt-2 !min-h-8 w-full text-xs" disabled={readOnly} onClick={handOff}>
              سوّ هاندوف وابدأ محادثة جديدة
            </button>
          </div>
        )}
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
            <Icon name="eye" size={13} className="text-jw-accent" /> حيدرة بيشوف المقطع المحدد «{as.name}» مع رسالتك
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
          placeholder={diag && diagOn ? "🩺 وش صار؟ مثلًا: ليش التصدير وقف؟" : "مثلًا: قص السكتات وحط كابشن"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {diag && (
          <button type="button" className={`jw-btn jw-btn-icon shrink-0 ${diagOn ? "!border-jw-accent bg-jw-accent/15 text-jw-accent" : "jw-btn-quiet"}`} onClick={() => setDiagOn((v) => !v)} aria-pressed={diagOn} aria-label="تشخيص" title="🩺 تشخيص (لك بس): حيدرة يفحص السجل والملفات والجهاز ويقول وش المشكلة، ويكتب رسالة للمطوّر">
            🩺
          </button>
        )}
        <button type="submit" className="jw-btn jw-btn-primary jw-btn-icon shrink-0" disabled={!text.trim() || !!busy || readOnly} aria-label="أرسل">
          <Icon name="chevronLeft" />
        </button>
      </form>
    </div>
  );
}

/** A reply as written: **bold**, and ```blocks``` (the designer's prompts) shown as copyable English blocks. */
function MsgText({ text }: { text: string }) {
  const parts = text.split(/```\n?([\s\S]*?)\n?```/g);
  return (
    <div className="space-y-1.5">
      {parts.map((part, i) =>
        i % 2 ? (
          <CodeBlock key={i} code={part} />
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap">
            {part.replace(/^\n+|\n+$/g, "").split(/\*\*(.+?)\*\*/g).map((x, j) => (j % 2 ? <b key={j}>{x}</b> : x))}
          </p>
        ) : null,
      )}
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-lg border border-jw-line bg-jw-bg-2">
      <button
        type="button"
        className="absolute end-1 top-1 rounded px-1.5 py-0.5 text-[10px] text-jw-muted hover:text-jw-ink"
        onClick={() =>
          navigator.clipboard
            .writeText(code)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => {})
        }
      >
        {copied ? "انتسخ ✓" : "انسخ"}
      </button>
      <pre className="jw-scroll max-h-48 overflow-auto whitespace-pre-wrap p-2 pt-5 text-[11px] leading-5" dir="ltr">
        {code}
      </pre>
    </div>
  );
}

/** Pictures of a clip (JPEG, base64) passed through its grading layers, as the export draws them. */
async function gradedFrames(frames: { t: number; data: string }[], layers: Grade[], own: (t: number) => number) {
  const out: { t: number; data: string; graded: true }[] = [];
  for (const f of frames) {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${f.data}`;
    await img.decode();
    const g = gradeLayers(img, img.naturalWidth, img.naturalHeight, layers, own(f.t), true);
    if (!g) continue;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(g.img, 0, 0, c.width, c.height);
    out.push({ t: f.t, data: c.toDataURL("image/jpeg", 0.72).split(",")[1], graded: true });
  }
  return out;
}
