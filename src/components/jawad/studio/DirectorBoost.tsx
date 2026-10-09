"use client";

import { fmtSar } from "@config/coins";
import SmartCoin from "@/components/SmartCoin";
import Icon from "../Icon";

/**
 * «المخرج الخارق» under the prompt (video making): one press, and the website rewrites the prompt in the background
 * and puts it in the prompt box. The price is on the button; the previous prompt can be brought back.
 */
export default function DirectorBoost({
  coins,
  disabledReason,
  busy,
  canUndo,
  onRun,
  onUndo,
}: {
  coins: number;
  /** Why it can't run now (shown under it), or null. */
  disabledReason: string | null;
  busy: boolean;
  canUndo: boolean;
  onRun: () => void;
  onUndo: () => void;
}) {
  return (
    <section aria-label="المخرج الخارق" className="rounded-xl border border-jw-accent/35 bg-jw-accent-soft p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-jw-bg-2 text-jw-accent"><Icon name="wand" size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">طوّر البرومبت بمهارة «المخرج الخارق»</p>
          <p className="text-[11px] text-jw-muted">يعيد كتابة فكرتك كبرومبت سينمائي لـ Seedance ويضعه مكان برومبتك.</p>
        </div>
        <button type="button" className="jw-btn jw-btn-primary shrink-0 !px-3" disabled={Boolean(disabledReason) || busy} onClick={onRun} aria-describedby={disabledReason ? "jw-director-why" : undefined}>
          {busy ? (
            <>
              <span className="jw-spinner" aria-hidden /> يكتب…
            </>
          ) : (
            <>
              طوّر
              <span className="flex items-center gap-1 rounded-full bg-black/25 px-1.5 py-0.5 text-xs tabular-nums" dir="ltr">
                <SmartCoin size={12} /> {fmtSar(coins)} ر.س
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

    </section>
  );
}
