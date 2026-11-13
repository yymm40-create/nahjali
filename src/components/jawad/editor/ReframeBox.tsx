"use client";

// «🎯 اتبع الوجه» (the project settings, under «المقاس»): when a wide video sits in a tall, square or 4:5 frame, each
// chosen clip follows the speaker's face — read in the browser (free), a calm camera path, given to the clip as motion
// points the person can move afterwards. One undo takes it all back.

import { useState } from "react";
import { formatTime, type Timeline } from "@/lib/editor/model";
import { track } from "@/lib/feature-track";
import { reframeCandidates, reframeClips, reframeShape, stillThere } from "./reframe-run";
import type { Run } from "./Inspector";
import type { EditorAsset } from "./types";

export default function ReframeBox({ tl, getTl, assets, run, readOnly, flash }: { tl: Timeline; /** the timeline as it is when the reading ends */ getTl?: () => Timeline; assets: Map<string, EditorAsset>; run: Run; readOnly: boolean; flash?: (t: string, bad?: boolean) => void }) {
  const [skip, setSkip] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ text: string; p: number; stop: AbortController } | null>(null);
  if (!reframeShape(tl)) return null;
  const all = reframeCandidates(tl, assets);
  if (!all.length) return null;
  const chosen = all.filter((x) => !skip.includes(x.clip.id));

  const go = async () => {
    const stop = new AbortController();
    setBusy({ text: "نجهّز…", p: 0, stop });
    track("editor.auto_reframe");
    try {
      const r = await reframeClips(tl, chosen, (text, p) => setBusy((b) => (b ? { ...b, text, p } : b)), stop.signal);
      const cmds = stillThere(getTl?.() ?? tl, r.commands);
      if (cmds.length) run(cmds, { label: r.done > 1 ? `اتبع الوجه (${r.done} مقاطع)` : "اتبع الوجه" });
      const miss = r.noFace.length ? ` ما لقينا وجه في: ${r.noFace.join("، ")}.` : "";
      flash?.(r.done ? `الكاميرا تتبع الوجه في ${r.done} ${r.done > 1 ? "مقاطع" : "مقطع"}. تقدر تعدّل نقاط الحركة من «حركة».${miss}` : `ما تغيّر شي.${miss}`, !r.done);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") flash?.(e instanceof Error ? e.message : "تعذّر.", true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-jw-accent/30 bg-jw-accent/5 p-2.5">
      <p className="text-xs font-bold">🎯 اتبع الوجه</p>
      <p className="text-[11px] leading-5 text-jw-muted">الفيديو العرضي في هذا المقاس ينقص من جوانبه. نقرأ الوجه في كل مقطع ونحرّك الصورة معه بهدوء مثل المصوّر، وتطلع نقاط حركة تقدر تعدّلها بعدين. مجاني وما يطلع من جهازك.</p>
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
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {all.map(({ clip, asset }) => (
              <li key={clip.id}>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" className="accent-[var(--jw-accent)]" disabled={readOnly} checked={!skip.includes(clip.id)} onChange={(e) => setSkip((x) => (e.target.checked ? x.filter((id) => id !== clip.id) : [...x, clip.id]))} />
                  <span className="min-w-0 flex-1 truncate" dir="auto">{asset.name || "مقطع"}</span>
                  <span className="tabular-nums text-jw-muted" dir="ltr">{formatTime(clip.start, false)}{clip.keys.length ? " · ✦" : ""}</span>
                </label>
              </li>
            ))}
          </ul>
          {chosen.some((x) => x.clip.keys.length) && <p className="text-[11px] leading-5 text-jw-warn">المقاطع اللي عليها ✦ فيها نقاط حركة؛ تتبّع الوجه يحط مكانها نقاط جديدة.</p>}
          <button type="button" className="jw-btn jw-btn-primary w-full text-xs" disabled={readOnly || !chosen.length} onClick={go}>
            اتبع الوجه ({chosen.length})
          </button>
        </>
      )}
    </div>
  );
}
