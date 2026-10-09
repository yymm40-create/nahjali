"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import SmartCoin from "@/components/SmartCoin";
import { fmtSar } from "@config/coins";
import { coinsOf } from "@config/jawad/generators";
import { adminPost } from "./client";

export interface AdminPriceGroup {
  id: string;
  name: string;
  keys: { key: string; label: string; basis: string; defaultCenti: number | null; overrideCenti: number | null }[];
}

// the owner writes and reads riyals of COST (the table keeps hundredths of a halala)
const coins = (c: number | null) => (c == null ? "" : (c / 10000).toFixed(2).replace(/\.00$/, ""));

/** «النقود الذكية» per supported price unit: the verified default, or the owner's price (every change logged). */
export default function PricesAdmin({ groups }: { groups: AdminPriceGroup[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((g) => (
        <section key={g.id} className="jw-panel space-y-3 p-4">
          <h2 className="font-semibold" dir="ltr" style={{ textAlign: "right" }}>{g.name}</h2>
          <ul className="space-y-2">
            {g.keys.map((k) => (
              <PriceRow key={k.key} generatorId={g.id} k={k} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PriceRow({ generatorId, k }: { generatorId: string; k: AdminPriceGroup["keys"][number] }) {
  const router = useRouter();
  const [value, setValue] = useState(coins(k.overrideCenti));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const effective = k.overrideCenti ?? k.defaultCenti;
  const changed = value !== coins(k.overrideCenti);
  async function save(v: string | null) {
    setBusy(true);
    setError("");
    try {
      await adminPost("price", { generatorId, key: k.key, coins: v });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="space-y-1.5 rounded-lg border border-jw-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">{k.label}</span>
        <span className={`flex items-center gap-1 text-sm tabular-nums ${effective == null ? "text-jw-warn" : ""}`}>
          {effective == null ? "موقوف حتى تحدد السعر" : (<><span dir="ltr">{coins(effective)}</span> تكلفة → <SmartCoin size={14} /><span dir="ltr">{fmtSar(coinsOf(effective))}</span> للعميل</>)}
        </span>
      </div>
      <p className="text-[11px] text-jw-faint">
        الافتراضي: {k.defaultCenti == null ? "— (غير متحقق)" : <span dir="ltr">{coins(k.defaultCenti)}</span>} · {k.basis}
      </p>
      <div className="flex items-center gap-2">
        <input
          className="jw-input w-32"
          inputMode="decimal"
          dir="ltr"
          placeholder={k.defaultCenti == null ? "مثال 1.5" : coins(k.defaultCenti)}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, "").slice(0, 9))}
          aria-label={`تكلفة ${k.label} بالريال`}
        />
        <button type="button" className="jw-btn jw-btn-primary" disabled={busy || !changed || !value} onClick={() => save(value)}>احفظ</button>
        {k.overrideCenti != null && (
          <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => (setValue(""), save(null))}>
            رجوع للافتراضي
          </button>
        )}
      </div>
      {error && <p className="text-xs text-jw-danger" role="alert">{error}</p>}
    </li>
  );
}
