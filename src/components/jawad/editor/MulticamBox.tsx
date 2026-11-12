"use client";

// «🎬 بدّل الكاميرات تلقائياً» (the settings panel, beside «🎯 زامن الصوت», once two or more synced cameras are on the
// timeline) and «بدّل الزاوية» (a cut's own settings): the picture follows who is speaking — read in the browser, free —
// and lands as ordinary clips on one track (one undo); the cameras' originals stay hidden and quiet for swapping.

import { useState } from "react";
import { clipEnd, formatTime, type Timeline } from "@/lib/editor/model";
import { angleOptions, MULTICAM } from "@/lib/editor/multicam";
import { track } from "@/lib/feature-track";
import { defaultSound, multicamCameras, planMulticam } from "./multicam-run";
import type { Run } from "./Inspector";
import type { EditorAsset } from "./types";

export default function MulticamBox({ tl, getTl, selected, assets, run, readOnly, flash }: { tl: Timeline; /** the timeline as it is when the reading ends */ getTl?: () => Timeline; selected: string[]; assets: Map<string, EditorAsset>; run: Run; readOnly: boolean; flash: (t: string, bad?: boolean) => void }) {
  const cams = multicamCameras(tl, assets, selected);
  const [wide, setWide] = useState<string | null>(null);
  const [minShot, setMinShot] = useState<number>(MULTICAM.minShotMs);
  const [faces, setFaces] = useState(false);
  const [sound, setSound] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ text: string; p: number; stop: AbortController } | null>(null);
  if (cams.length < 2) return null;
  const soundNow = sound && (sound === "keep" || sound === "follow" || cams.some((c) => c.clip.id === sound)) ? sound : defaultSound(tl, cams, assets);
  const wideNow = wide && cams.some((c) => c.clip.id === wide) ? wide : null;
  const name = (i: number) => cams[i].asset.name || `كاميرا ${i + 1}`;

  const go = async () => {
    const stop = new AbortController();
    setBusy({ text: "نجهّز…", p: 0, stop });
    track("editor.multicam");
    try {
      const r = await planMulticam(cams, { minShotMs: minShot, wide: wideNow, faces, sound: soundNow }, (text, p) => setBusy((b) => (b ? { ...b, text, p } : b)), stop.signal);
      // a camera deleted or moved meanwhile: the plan no longer fits, the command says so
      const now = getTl?.() ?? tl;
      if (cams.some((c) => !now.tracks.some((t) => t.clips.some((x) => x.id === c.clip.id && x.start === c.clip.start)))) throw new Error("تغيّرت الكاميرات وانت تنتظر؛ أعد التبديل.");
      if (run(r.command, { label: `بدّل الكاميرات (${r.shots.length} لقطة)` })) flash(`بدّلت بين الكاميرات: ${r.notes.join(" ")} اضغط أي لقطة وبدّل زاويتها من إعداداتها.`);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") flash(e instanceof Error ? e.message : "تعذّر التبديل.", true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-jw-accent/30 bg-jw-accent/5 p-2.5">
      <p className="text-xs font-bold">🎬 بدّل الكاميرات تلقائيًا</p>
      <p className="text-[11px] leading-5 text-jw-muted">بعد «زامن الصوت»: نسمع مايك كل كاميرا ونقطع على اللي يتكلم (الأقرب للمايك يفوز)، بدون رمشة، وتطلع لقطات عادية في مسار واحد. الكاميرات الأصلية تبقى مخفية لين تبي تبدّل زاوية أي لقطة. مجاني وما يطلع من جهازك.</p>
      {busy ? (
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-jw-bg-2">
            <div className="h-full rounded-full bg-jw-accent transition-all" style={{ width: `${Math.round(busy.p * 100)}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-jw-muted">
            <span className="min-w-0 truncate">{busy.text}</span>
            <button type="button" className="shrink-0 underline" onClick={() => busy.stop.abort()}>
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {cams.map((c, i) => (
              <li key={c.clip.id} className="flex items-center gap-2 text-xs">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-jw-surface-2 text-[10px] font-bold">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate" dir="auto">{name(i)}</span>
                <span className="tabular-nums text-jw-faint" dir="ltr">{formatTime(c.clip.start, false)}–{formatTime(clipEnd(c.clip), false)}</span>
                <label className="flex shrink-0 items-center gap-1 text-[11px] text-jw-muted" title="لقطة تجمع الكل: تنعرض لما يتكلمون مع بعض أو يسكتون فترة">
                  <input type="checkbox" className="accent-[var(--jw-accent)]" disabled={readOnly} checked={wideNow === c.clip.id} onChange={(e) => setWide(e.target.checked ? c.clip.id : null)} />
                  واسعة
                </label>
              </li>
            ))}
          </ul>
          <label className="block space-y-1 text-[11px] text-jw-muted">
            <span className="flex justify-between">
              <span>أقصر لقطة</span>
              <b className="tabular-nums text-jw-ink">{(minShot / 1000).toFixed(1)} ث</b>
            </span>
            <input type="range" className="w-full accent-[var(--jw-accent)]" min={MULTICAM.minShotRange[0]} max={MULTICAM.minShotRange[1]} step={100} value={minShot} disabled={readOnly} onChange={(e) => setMinShot(Number(e.target.value))} />
          </label>
          <label className="block space-y-1 text-[11px] text-jw-muted">
            <span>الصوت</span>
            <select className="jw-input !min-h-8 w-full text-xs" disabled={readOnly} value={soundNow} onChange={(e) => setSound(e.target.value)}>
              <option value="follow">صوت كل لقطة من كاميرتها</option>
              <option value="keep">الصوت اللي في مسارات الصوت (مايك منفصل)</option>
              {cams.map((c, i) => (
                <option key={c.clip.id} value={c.clip.id}>صوت ثابت من: {name(i)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2 text-[11px]">
            <input type="checkbox" className="mt-0.5 accent-[var(--jw-accent)]" disabled={readOnly} checked={faces} onChange={(e) => setFaces(e.target.checked)} />
            <span>
              <b>انتبه للوجوه كمان</b>
              <span className="block text-jw-muted">الكاميرا اللي ما فيها وجه بهاللحظة تنعرض أقل. أبطأ شوي.</span>
            </span>
          </label>
          <button type="button" className="jw-btn jw-btn-primary w-full text-xs" disabled={readOnly} onClick={go}>
            بدّل الكاميرات ({cams.length})
          </button>
        </>
      )}
    </div>
  );
}

/** «بدّل الزاوية»: the same moment from another of the synced cameras, one tap each. */
export function AngleSwap({ tl, clipId, run, locked }: { tl: Timeline; clipId: string; run: Run; locked: boolean }) {
  const options = angleOptions(tl, clipId);
  if (options.length < 2) return null;
  return (
    <div className="space-y-1.5 rounded-xl border border-jw-line p-2.5">
      <p className="text-xs font-semibold">🎬 بدّل الزاوية</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.clipId}
            type="button"
            aria-pressed={o.on}
            disabled={locked || o.on}
            className={`jw-btn !min-h-8 text-xs ${o.on ? "jw-btn-primary" : ""}`}
            onClick={() => {
              track("editor.multicam_angle");
              run({ type: "multicam_angle", clipId, cam: o.clipId });
            }}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The next camera for a cut (the right-click menu's «بدّل الزاوية»): the one after the current, round. */
export function nextAngle(tl: Timeline, clipId: string): string | null {
  const o = angleOptions(tl, clipId);
  if (o.length < 2) return null;
  const i = o.findIndex((x) => x.on);
  return o[(i + 1) % o.length].clipId;
}
