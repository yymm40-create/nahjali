"use client";

import { useState } from "react";
import SmartCoin from "@/components/SmartCoin";
import Dialog from "../Dialog";
import Icon from "../Icon";

/**
 * «المخرج الخارق» under the prompt (video making): asks first, then the website rewrites the prompt in the background
 * and puts it in the prompt box. The price is on the button; the previous prompt can be brought back.
 */
export default function DirectorBoost({
  coins,
  owner,
  disabledReason,
  busy,
  canUndo,
  onRun,
  onUndo,
}: {
  coins: number;
  owner: boolean;
  /** Why it can't run now (shown under it), or null. */
  disabledReason: string | null;
  busy: boolean;
  canUndo: boolean;
  onRun: () => void;
  onUndo: () => void;
}) {
  const [ask, setAsk] = useState(false);
  return (
    <section aria-label="المخرج الخارق" className="rounded-xl border border-jw-accent/35 bg-jw-accent-soft p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-jw-bg-2 text-jw-accent"><Icon name="wand" size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">طوّر البرومبت بمهارة «المخرج الخارق»</p>
          <p className="text-[11px] text-jw-muted">يعيد كتابة فكرتك كبرومبت سينمائي لـ Seedance ويضعه مكان برومبتك.</p>
        </div>
        <button type="button" className="jw-btn jw-btn-primary shrink-0 !px-3" disabled={Boolean(disabledReason) || busy} onClick={() => setAsk(true)} aria-describedby={disabledReason ? "jw-director-why" : undefined}>
          {busy ? (
            <>
              <span className="jw-spinner" aria-hidden /> يكتب…
            </>
          ) : (
            <>
              طوّر
              <span className="flex items-center gap-1 rounded-full bg-black/25 px-1.5 py-0.5 text-xs tabular-nums" dir="ltr">
                <SmartCoin size={12} /> {coins}
              </span>
            </>
          )}
        </button>
      </div>
      {disabledReason && !busy && <p id="jw-director-why" className="mt-1.5 text-[11px] text-jw-muted">{disabledReason}</p>}
      {canUndo && !busy && (
        <button type="button" onClick={onUndo} className="mt-1.5 flex items-center gap-1 text-[11px] text-jw-muted underline hover:text-jw-ink">
          <Icon name="retry" size={12} /> استرجع برومبتك السابق
        </button>
      )}

      <Dialog open={ask} onClose={() => setAsk(false)} title="المخرج الخارق">
        <div className="space-y-3 p-4">
          <p className="font-semibold">تبي تطوّر البرومبت بمهارة «المخرج الخارق»؟</p>
          <ul className="list-disc space-y-1 ps-5 text-sm text-jw-muted">
            <li>
              {owner ? "سعره " : "يُخصم "}
              <span className="font-semibold text-jw-ink" dir="ltr">{coins}</span> نقدة{owner ? " (لا يُخصم منك كمالك)" : ""}، ويُعاد إذا تعذّر التطوير.
            </li>
            <li>يُكتب برومبت جديد (إنجليزي ثم صيني) مكان برومبتك الحالي، مع الحفاظ على مدة الفيديو وإعداداته ومراجعك.</li>
            <li>تقدر ترجع لبرومبتك السابق، وبعدها تراجعه وتضغط «توليد» بنفسك.</li>
          </ul>
          <div className="flex justify-end gap-2">
            <button type="button" className="jw-btn" onClick={() => setAsk(false)}>لا</button>
            <button
              type="button"
              className="jw-btn jw-btn-primary"
              onClick={() => {
                setAsk(false);
                onRun();
              }}
            >
              نعم، طوّره
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
