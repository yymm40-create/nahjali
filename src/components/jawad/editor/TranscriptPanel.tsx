"use client";

// «النص» (editing from the transcript, the Descript way): what is said on the timeline, word by word in the order it is
// heard. A word pressed moves the playhead to it; the word being said lights up while it plays; words chosen (a press
// and a drag, or Shift) and «حذف» (or Backspace) cut their seconds out of every track — one undo — and stay struck
// through here until that undo. «شيل الحشو» chooses the filler words («اممم»، «آآ»، «يعني» on its own, um/uh) to look
// over before they go. With nothing written yet it offers «كابشن»'s listening, at its price.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatTime, type Timeline } from "@/lib/editor/model";
import { fillers, heardClips, keysBetween, lineAt, needsListening, paragraphs, rangesFor, readingOrder, type AssetSpeech, type Line } from "@/lib/editor/transcript";
import { coinStr } from "@config/coins";
import { postJson } from "@/lib/fetch";
import { track } from "@/lib/feature-track";
import DockFrame from "./DockFrame";
import Icon from "../Icon";
import { spokenWords, type CaptionSource } from "./captions-make";
import type { Run } from "./Inspector";
import type { PlayerLike } from "./Timeline";
import type { EditorAsset } from "./types";

const LANGS = [
  ["ar", "عربي"],
  ["en", "English"],
  ["", "تلقائي"],
] as const;

export default function TranscriptPanel({ dock, open, onClose, projectId, tl, assets, run, flash, player, readOnly }: { dock?: HTMLElement | null; open: boolean; onClose: () => void; projectId: string; tl: Timeline; assets: Map<string, EditorAsset>; run: Run; flash: (t: string, bad?: boolean) => void; player: PlayerLike | null; readOnly: boolean }) {
  const [speech, setSpeech] = useState<Record<string, AssetSpeech> | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [lang, setLang] = useState<string>("ar");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [review, setReview] = useState(false);
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const [now, setNow] = useState<string | null>(null);
  // «من هنا لهنا» (a phone has no Shift and no drag over words): the next press chooses everything from the last one
  const [span, setSpan] = useState(false);
  const anchor = useRef<string | null>(null);
  const drag = useRef<{ key: string; moved: boolean } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // the heard clips (only files with sound) and the ones not written yet
  const sources: CaptionSource[] = useMemo(
    () =>
      heardClips(tl).flatMap(({ clip }) => {
        const a = clip.assetId ? assets.get(clip.assetId) : null;
        return a && a.kind !== "image" && a.hasAudio && a.url ? [{ clip, asset: a }] : [];
      }),
    [tl, assets],
  );
  const missingOf = useCallback((sp: Record<string, AssetSpeech>) => sources.filter((s) => needsListening(sp[s.asset.id]?.spans, s.clip)), [sources]);
  const sigOf = (list: CaptionSource[]) => list.map((s) => `${s.asset.id}:${s.clip.in}-${s.clip.out}`).join("|");
  const missing = speech ? missingOf(speech) : [];
  const missingSig = sigOf(missing);
  const loaded = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await postJson<{ speech: Record<string, AssetSpeech>; price: number }>(`/api/jawad/editor/projects/${projectId}`, { action: "transcripts", clips: sources.map((s) => ({ assetId: s.asset.id, from: s.clip.in, to: s.clip.out })) });
      // what was read is what the price is for: read again only when that changes
      loaded.current = sigOf(missingOf(r.speech));
      setSpeech(r.speech);
      setPrice(r.price);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ما قدرنا نجيب النص.");
    }
  }, [projectId, sources, missingOf]);
  // read when the panel opens, and again when what still needs listening changes (its price with it)
  useEffect(() => {
    if (!open) {
      loaded.current = null;
      return;
    }
    const sig = speech ? missingSig : "first";
    if (loaded.current === sig) return;
    loaded.current = sig;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [open, speech, missingSig, load]);

  const lines = useMemo(() => (speech ? readingOrder(tl, speech, struck) : []), [tl, speech, struck]);
  const byKey = useMemo(() => new Map(lines.map((l) => [l.key, l])), [lines]);
  const live = lines.filter((l) => l.clipId);
  // a chosen word no longer heard (cut, or its clip deleted) is no longer chosen
  const picked = [...chosen].filter((k) => byKey.get(k)?.clipId);

  // the word being said lights up (and is kept in sight while playing)
  useEffect(() => {
    if (!open || !player) return;
    const off = player.subscribe((ms, playing) => {
      const i = lineAt(lines, ms);
      const key = i >= 0 ? lines[i].key : null;
      setNow((k) => (k === key ? k : key));
      if (playing && key) box.current?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return off;
  }, [open, player, lines]);

  const listen = async () => {
    setError(null);
    try {
      for (const [i, s] of missing.entries()) await spokenWords(projectId, s, lang, missing.length > 1 ? `المقطع ${i + 1} من ${missing.length}` : "المقطع", setBusy);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(null);
    }
  };

  const cut = () => {
    if (!picked.length || readOnly) return;
    const ranges = rangesFor(lines, new Set(picked));
    if (!ranges.length) return;
    const n = picked.length;
    const r = run({ type: "remove_ranges", ranges }, { label: review ? `شلت الحشو (${n} كلمة)` : n > 1 ? `حذفت ${n} كلمات من النص` : `حذفت «${byKey.get(picked[0])?.w ?? ""}» من النص` });
    if (!r) return;
    track(review ? "editor.filler_removal" : "editor.transcript_edit");
    setStruck((x) => new Set([...x, ...picked]));
    setChosen(new Set());
    setReview(false);
  };

  const findFillers = () => {
    const keys = fillers(lines);
    if (!keys.length) return flash("ما لقينا كلمات حشو («اممم»، «آآ»، «يعني» لحالها).");
    setChosen(new Set(keys));
    setReview(true);
    box.current?.querySelector(`[data-key="${CSS.escape(keys[0])}"]`)?.scrollIntoView({ block: "center" });
  };

  // pressing, dragging and Shift over the words
  const keyOf = (t: EventTarget | null) => ((t as HTMLElement | null)?.closest?.("[data-key]") as HTMLElement | null)?.dataset.key ?? null;
  const down = (e: React.PointerEvent) => {
    const k = keyOf(e.target);
    const l = k ? byKey.get(k) : null;
    if (!k || !l?.clipId) return;
    e.preventDefault();
    box.current?.focus();
    if ((e.shiftKey || span) && anchor.current && !review) {
      setChosen(new Set(keysBetween(lines, anchor.current, k)));
      setSpan(false);
      return;
    }
    drag.current = { key: k, moved: false };
    if (!review) {
      anchor.current = k;
      setChosen(new Set([k]));
    }
  };
  const over = (e: React.PointerEvent) => {
    const d = drag.current;
    const k = keyOf(e.target);
    if (!d || !k || k === d.key || review) return;
    d.moved = true;
    setChosen(new Set(keysBetween(lines, anchor.current ?? d.key, k)));
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const l = byKey.get(d.key);
    if (review) {
      // reviewing the fillers: a press takes a word out of the cut (or back in)
      setChosen((x) => {
        const n = new Set(x);
        if (n.has(d.key)) n.delete(d.key);
        else n.add(d.key);
        return n;
      });
      return;
    }
    if (l?.clipId && player) player.seek(l.from + 1);
  };
  const keyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Backspace" || e.key === "Delete") && picked.length) {
      e.preventDefault();
      e.stopPropagation();
      cut();
    } else if (e.key === "Escape" && chosen.size) {
      e.stopPropagation();
      setChosen(new Set());
      setReview(false);
    }
  };

  const paras = useMemo(() => paragraphs(lines), [lines]);
  const word = (l: Line) => {
    const gone = !l.clipId;
    const on = !gone && chosen.has(l.key);
    const cls = gone ? "text-jw-faint line-through decoration-jw-danger/70" : on ? (review ? "bg-jw-warn/25 text-jw-ink ring-1 ring-jw-warn/60" : "bg-jw-accent/25 text-jw-ink") : now === l.key ? "bg-jw-accent/15 text-jw-accent" : "hover:bg-jw-surface-2";
    return (
      <span key={l.key} data-key={l.key} title={gone ? "انحذفت — «تراجع» يرجعها" : formatTime(l.from)} className={`cursor-pointer rounded px-0.5 transition-colors ${cls}`}>
        {l.w}
      </span>
    );
  };

  return (
    <DockFrame dock={dock} open={open} onClose={() => !busy && onClose()} title="النص">
      <div className="space-y-3 p-4">
        <p className="text-xs leading-6 text-jw-muted">عدّل الفيديو من كلامه: اضغط كلمة يروح المؤشر لها، اسحب على كلمات (أو Shift) تختارها، و«حذف» يشيل وقتها من كل المسارات. التراجع يرجعها.</p>

        {!speech && !error && (
          <p className="flex items-center gap-2 text-xs text-jw-muted">
            <span className="jw-spinner" /> نجيب النص…
          </p>
        )}

        {speech && !sources.length && <p className="text-xs text-jw-warn">ما فيه مقاطع فيها صوت في التايملاين.</p>}

        {speech && missing.length > 0 && (
          <div className="space-y-2 rounded-xl border border-jw-line p-2.5">
            <p className="text-xs font-bold">{live.length ? `${missing.length} ${missing.length > 1 ? "مقاطع ما انكتب كلامها" : "مقطع ما انكتب كلامه"} بعد` : "ما انكتب كلام المقاطع بعد"}</p>
            <p className="text-[11px] leading-5 text-jw-muted">نسمع الكلام ونكتبه كلمة كلمة بوقتها (نفس سماع «الكابشن»، وينحفظ مع الملف فما يتكرر سعره).</p>
            <div className="jw-seg" role="radiogroup" aria-label="اللغة">
              {LANGS.map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={lang === k} onClick={() => setLang(k)}>{label}</button>
              ))}
            </div>
            <button type="button" className="jw-btn jw-btn-primary w-full" disabled={!!busy || readOnly} onClick={listen}>
              {busy ? <span className="jw-spinner" /> : <Icon name="sparkles" size={16} />} {busy ?? `اكتب الكلام (${Math.max(1, Math.ceil(missing.reduce((m, s) => m + (s.clip.out - s.clip.in) / 60_000, 0)))} دقيقة) · ${price ? coinStr(price) : "مجاني"}`}
            </button>
          </div>
        )}

        {live.length > 0 && (
          <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-1.5 bg-jw-surface/95 px-1 py-1.5 backdrop-blur">
            <button type="button" className="jw-btn jw-btn-primary !min-h-8 text-xs" disabled={readOnly || !picked.length} onClick={cut} title="يشيل وقت الكلمات المختارة من كل المسارات (Backspace)">
              <Icon name="trash" size={14} /> حذف{picked.length ? ` (${picked.length})` : ""}
            </button>
            {review ? (
              <button type="button" className="jw-btn !min-h-8 text-xs" onClick={() => (setChosen(new Set()), setReview(false))}>
                إلغاء
              </button>
            ) : (
              <button type="button" className="jw-btn !min-h-8 text-xs" disabled={readOnly} onClick={findFillers} title="يختار «اممم» و«آآ» و«يعني» لحالها (وum/uh) تراجعها قبل الحذف">
                🧹 شيل الحشو
              </button>
            )}
            {!review && picked.length > 0 && (
              <button type="button" aria-pressed={span} className={`jw-btn !min-h-8 text-xs ${span ? "border-jw-accent bg-jw-accent/10" : "jw-btn-quiet"}`} onClick={() => setSpan((v) => !v)} title="اضغطها وبعدين اضغط آخر كلمة: يختار كل اللي بينهم">
                ⇆ من هنا لهنا
              </button>
            )}
            {!review && picked.length > 0 && (
              <button type="button" className="jw-btn jw-btn-quiet !min-h-8 text-xs" onClick={() => (setChosen(new Set()), setSpan(false))}>
                شيل الاختيار
              </button>
            )}
          </div>
        )}
        {review && <p className="rounded-lg bg-jw-warn/10 p-2 text-[11px] leading-5 text-jw-ink">اخترنا {picked.length} كلمة حشو (بالأصفر). اضغط أي كلمة تبيها تبقى تشيلها من الاختيار، وبعدين «حذف».</p>}

        {live.length > 0 || lines.length > 0 ? (
          <div ref={box} tabIndex={0} role="textbox" aria-readonly aria-label="نص الفيديو" dir="auto" onKeyDown={keyDown} onPointerDown={down} onPointerOver={over} onPointerUp={up} onPointerLeave={() => (drag.current = null)} className="select-none space-y-3 rounded-xl bg-jw-surface-2/60 p-3 text-[15px] leading-8 outline-none focus-visible:ring-1 focus-visible:ring-jw-accent">
            {paras.map((p) => {
              const first = p.find((l) => l.clipId);
              return (
                <p key={p[0].key}>
                  {first && <span className="me-1.5 select-none align-middle text-[10px] tabular-nums text-jw-faint" dir="ltr">{formatTime(first.from, false)}</span>}
                  {p.map((l, i) => (
                    <span key={l.key}>
                      {i > 0 && " "}
                      {word(l)}
                    </span>
                  ))}
                </p>
              );
            })}
          </div>
        ) : null}

        {error && <p className="error-box text-sm">{error}</p>}
      </div>
    </DockFrame>
  );
}
