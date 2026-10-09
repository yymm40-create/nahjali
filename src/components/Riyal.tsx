import SmartCoin from "./SmartCoin";
import { fmtSar, savingPct } from "@config/coins";

/**
 * A price as the person sees it everywhere: the coin's logo and the amount — never a currency word, and — when the full-margin price is
 * higher — that price struck through with the saving («عرض الإطلاق»). `halalas` is what is charged.
 */
export default function Riyal({ halalas, was = null, size = 14, className = "", free = false }: { halalas: number | null | undefined; was?: number | null; size?: number; className?: string; /** nothing is charged (the owner, a free guest) */ free?: boolean }) {
  if (halalas == null) return null;
  const save = was != null ? savingPct(halalas, was) : 0;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${className}`}>
      <SmartCoin size={size} />
      <span dir="ltr">{free ? "0" : fmtSar(halalas)}</span>
      {!free && save > 0 && was != null && (
        <>
          <s dir="ltr" className="text-[0.85em] opacity-60">{fmtSar(was)}</s>
          <span className="rounded-full bg-emerald-500/15 px-1.5 text-[0.7em] font-semibold text-emerald-600">خصم {save}٪</span>
        </>
      )}
    </span>
  );
}
