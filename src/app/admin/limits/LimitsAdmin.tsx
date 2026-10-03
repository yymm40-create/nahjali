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
interface Section {
  key: string;
  label: string;
  modes: { code: number; label: string }[];
  current: number;
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

export default function LimitsAdmin({ sections, limits, rows }: { sections: Section[]; limits: Limit[]; rows: Row[] }) {
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

  const allowOf = (e: string, section: string) => rows.find((r) => r.scope === "email" && r.target === e && r.key === `allow_${section}`)?.value;
  const labelOf = (key: string, value: number) => {
    const s = /^allow_(.+)$/.exec(key)?.[1];
    if (s) return `${sections.find((x) => x.key === s)?.label ?? s}: ${value ? "مسموح دائمًا" : "محظور"}`;
    return `${limits.find((l) => l.key === key)?.label ?? key}: ${value}`;
  };

  return (
    <div className="space-y-6">
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🚪 مين يقدر يستخدم</h2>
        {sections.map((s) => (
          <div key={s.key} className="space-y-2 rounded-2xl border border-line p-3">
            <p className="font-extrabold">{s.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {s.modes.map((m) => (
                <button
                  key={m.code}
                  className={`rounded-2xl border-2 p-2 text-sm font-extrabold ${s.current === m.code ? "border-gold bg-gold/10" : "border-line"}`}
                  disabled={busy || s.current === m.code}
                  aria-pressed={s.current === m.code}
                  onClick={() => window.confirm(`${s.label}: «${m.label}»؟`) && save({ action: "set", scope: "all", key: `access_${s.key}`, value: m.code })}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {s.key === "film" && (
              <p className="text-xs font-bold text-muted">«إيميلات محددة»: قائمة المدعوين في صفحة فرع الفيلم، أو «مسموح دائمًا» تحت. «التجربة»: عددهم وفيديوهاتهم من الحدود تحت.</p>
            )}
            {s.key === "booklet" && <p className="text-xs font-bold text-muted">«إيميلات محددة»: اللي تحط لهم «مسموح دائمًا» تحت. غيرهم يشوفه «تحت التطوير».</p>}
          </div>
        ))}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">👥 الحدود للجميع</h2>
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
        <p className="text-sm font-bold text-muted">اسمح أو احظر شخص معيّن، أو ارفع ونزّل حدوده. اللي تخليه فاضي ياخذ إعداد الجميع.</p>
        <input className="field" dir="ltr" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target) &&
          sections.map((s) => {
            const own = allowOf(target, s.key);
            const options: [number | null, string][] = [[null, "حسب الإعداد العام"], [1, "✅ مسموح دائمًا"], [0, "⛔ محظور"]];
            return (
              <div key={`${target}-${s.key}`} className="space-y-2 rounded-2xl border border-line p-3">
                <p className="font-extrabold">{s.label}</p>
                <div className="grid grid-cols-3 gap-2">
                  {options.map(([v, label]) => {
                    const on = (own ?? null) === v;
                    return (
                      <button
                        key={label}
                        className={`rounded-2xl border-2 p-2 text-xs font-extrabold ${on ? "border-gold bg-gold/10" : "border-line"}`}
                        disabled={busy || on}
                        aria-pressed={on}
                        onClick={() => save({ action: "set", scope: "email", target, key: `allow_${s.key}`, value: v === null ? "" : v })}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
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
                    {rows.filter((r) => r.scope === "email" && r.target === e).map((r) => labelOf(r.key, r.value)).join(" · ")}
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
