"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

interface Limit {
  key: string;
  label: string;
  hint: string;
  def: number;
  perUser: boolean;
}
interface Row {
  scope: string;
  target: string;
  key: string;
  value: number;
}

/** Number field that saves on its button; empty = back to the inherited value. */
function LimitField({ limit, value, inherited, onSave, busy }: { limit: Limit; value: number | undefined; inherited: number; onSave: (v: string) => void; busy: boolean }) {
  const [v, setV] = useState(value === undefined ? "" : String(value));
  const changed = v !== (value === undefined ? "" : String(value));
  return (
    <div className="space-y-1 rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <label className="font-extrabold" htmlFor={`${limit.key}-f`}>{limit.label}</label>
        <div className="flex items-center gap-1">
          <button type="button" className="btn btn-ghost min-h-10 w-10 px-0" disabled={busy} onClick={() => setV(String(Math.max(0, Number(v || inherited) - 1)))} aria-label="أنقص">−</button>
          <input
            id={`${limit.key}-f`}
            className="field min-h-10 w-20 text-center"
            inputMode="numeric"
            dir="ltr"
            value={v}
            placeholder={String(inherited)}
            onChange={(e) => setV(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
          />
          <button type="button" className="btn btn-ghost min-h-10 w-10 px-0" disabled={busy} onClick={() => setV(String(Number(v || inherited) + 1))} aria-label="زِد">+</button>
        </div>
      </div>
      <p className="text-xs font-bold text-muted">{limit.hint} · {value === undefined ? `الحالي ${inherited} (موروث)` : `مضبوط على ${value}`}</p>
      {changed && (
        <button className="btn btn-primary min-h-10 w-full text-sm" disabled={busy} onClick={() => onSave(v)}>
          {v === "" ? "رجّعه للموروث" : "احفظ"}
        </button>
      )}
    </div>
  );
}

/** «حيدرة كت»'s prices for everyone (who may use what is on «السماح»). */
export default function LimitsAdmin({ limits, rows }: { limits: Limit[]; rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allOf = (key: string) => rows.find((r) => r.scope === "all" && r.key === key)?.value;

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/admin/limits", body);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">✂️ أسعار حيدرة كت</h2>
        <p className="text-sm font-bold text-muted">تنحسب بس إذا شغّلت «النقود الذكية مطلوبة»، وعلى اللي مو في قائمة «السماح». مين يدخل وش: من صفحة «🔐 السماح».</p>
        {limits.map((l) => (
          <LimitField
            key={`all-${l.key}-${allOf(l.key) ?? ""}`}
            limit={l}
            value={allOf(l.key)}
            inherited={l.def}
            busy={busy}
            onSave={(v) => save({ action: "set", scope: "all", key: l.key, value: v })}
          />
        ))}
      </section>
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}
