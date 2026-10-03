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

export default function LimitsAdmin({ limits, rows }: { limits: Limit[]; rows: Row[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const allOf = (key: string) => rows.find((r) => r.scope === "all" && r.key === key)?.value;
  const emails = [...new Set(rows.filter((r) => r.scope === "email").map((r) => r.target))];

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

  const perUser = limits.filter((l) => l.perUser);
  const target = email.trim().toLowerCase();

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">👥 للجميع</h2>
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

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">📧 حسب الإيميل</h2>
        <p className="text-sm font-bold text-muted">ارفع أو نزّل لشخص معيّن. اللي تخليه فاضي ياخذ حد الجميع.</p>
        <input className="field" dir="ltr" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) &&
          perUser.map((l) => {
            const own = rows.find((r) => r.scope === "email" && r.target === target && r.key === l.key)?.value;
            return (
              <LimitField
                key={`${target}-${l.key}-${own ?? ""}`}
                limit={l}
                value={own}
                inherited={allOf(l.key) ?? l.def}
                busy={busy}
                onSave={(v) => save({ action: "set", scope: "email", target, key: l.key, value: v })}
              />
            );
          })}

        {emails.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-extrabold">الأشخاص اللي لهم حدود خاصة</h3>
            {emails.map((e) => (
              <div key={e} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3">
                <button className="text-start" onClick={() => setEmail(e)}>
                  <span className="block font-extrabold" dir="ltr">{e}</span>
                  <span className="block text-xs font-bold text-muted">
                    {rows.filter((r) => r.scope === "email" && r.target === e).map((r) => `${limits.find((l) => l.key === r.key)?.label ?? r.key}: ${r.value}`).join(" · ")}
                  </span>
                </button>
                <button className="btn btn-ghost min-h-10 px-3 text-sm" disabled={busy} onClick={() => window.confirm(`تشيل كل الحدود الخاصة بـ ${e}؟`) && save({ action: "remove_email", scope: "email", target: e })}>
                  شيلها
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-1 p-4 opacity-60">
        <h2 className="text-xl font-extrabold">💳 حسب الباقة</h2>
        <p className="text-sm font-bold text-muted">قريبًا: لما تتفعّل الباقات، تحدد هنا حدود كل باقة، ومشتركينها ياخذونها تلقائيًا.</p>
      </section>

      {error && <p className="error-box">{error}</p>}
    </div>
  );
}
