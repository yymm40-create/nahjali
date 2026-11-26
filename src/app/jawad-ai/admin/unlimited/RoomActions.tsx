"use client";

// «متابعة اللامحدود»: the owner's two actions on a person — add minutes to a purchase, give riyals back — each confirmed on the page
// (a second tap), never with a browser dialog.

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(body: Record<string, unknown>) {
  const r = await fetch("/api/jawad/admin/unlimited", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(j.error || "ما زبطت، جرّب مرة ثانية.");
  return j;
}

export function AddMinutes({ userId, paymentId }: { userId: string; paymentId: string }) {
  const router = useRouter();
  const [min, setMin] = useState("15");
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState("");
  const n = Math.round(Number(min));
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <input className="w-16 rounded-md border border-jw-line bg-jw-surface-2 px-2 py-1 text-center text-xs" dir="ltr" inputMode="numeric" value={min} onChange={(e) => { setMin(e.target.value.replace(/[^\d-]/g, "")); setSure(false); }} aria-label="دقايق" />
      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs font-bold ${sure ? "bg-amber-500 text-black" : "bg-jw-accent text-white"}`}
        disabled={!n}
        onClick={async () => {
          if (!sure) return setSure(true);
          setSure(false);
          try {
            const r = (await post({ action: "minutes", userId, paymentId, minutes: n })) as { bonusMin?: number };
            setMsg(`✓ صار المضاف ${r.bonusMin} د`);
            router.refresh();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "خطأ");
          }
        }}
      >
        {sure ? `أكّد ${n > 0 ? "+" : ""}${n} د` : "⏱️ زيد دقايق"}
      </button>
      {msg && <span className="text-[11px] text-jw-muted">{msg}</span>}
    </span>
  );
}

export function Refund({ userId, suggest }: { userId: string; suggest: number }) {
  const router = useRouter();
  const [sar, setSar] = useState(suggest > 0 ? String(suggest) : "");
  const [note, setNote] = useState("تعويض: انخصم وأنت مشترك في لامحدود");
  const [sure, setSure] = useState(false);
  const [msg, setMsg] = useState("");
  const n = Number(sar);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input className="w-20 rounded-md border border-jw-line bg-jw-surface-2 px-2 py-1 text-center text-xs" dir="ltr" inputMode="decimal" value={sar} onChange={(e) => { setSar(e.target.value.replace(/[^\d.]/g, "")); setSure(false); }} aria-label="المبلغ بالريال" />
      <input className="min-w-0 flex-1 rounded-md border border-jw-line bg-jw-surface-2 px-2 py-1 text-xs" value={note} onChange={(e) => { setNote(e.target.value); setSure(false); }} aria-label="الملاحظة" />
      <button
        type="button"
        className={`rounded-md px-2 py-1 text-xs font-bold ${sure ? "bg-amber-500 text-black" : "bg-emerald-600 text-white"}`}
        disabled={!(n > 0)}
        onClick={async () => {
          if (!sure) return setSure(true);
          setSure(false);
          try {
            await post({ action: "refund", userId, sar: n, note });
            setMsg(`✓ رجعنا ${n} ريال`);
            router.refresh();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "خطأ");
          }
        }}
      >
        {sure ? `أكّد إرجاع ${n} ريال` : "💸 رجّع لرصيده"}
      </button>
      {msg && <span className="text-[11px] text-jw-muted">{msg}</span>}
    </span>
  );
}
