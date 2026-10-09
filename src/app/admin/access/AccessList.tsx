"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";
import { ALL_PERMS, PERMS, type Perm } from "@config/access";

/** One email on «السماح»: a chip per section (✓ on, press again to close it), and × to take it off the list. */
export function AccessRow({ email, perms, unlimited = false, fixed, onRemoved }: { email: string; perms: Perm[]; unlimited?: boolean; fixed?: string; onRemoved?: () => void }) {
  const router = useRouter();
  const [on, setOn] = useState<Perm[]>(perms);
  const [free, setFree] = useState(unlimited);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/admin/access", body);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function toggle(k: Perm) {
    const next = on.includes(k) ? on.filter((x) => x !== k) : [...on, k];
    const before = on;
    setOn(next);
    if (!(await send({ action: "set", email, perms: next }))) setOn(before);
  }
  const all = on.length === ALL_PERMS.length;

  return (
    <li className="space-y-2 rounded-2xl border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <b className="min-w-0 flex-1 truncate" dir="ltr">{email}</b>
        {fixed ? (
          <span className="chip bg-gold text-on-gold">{fixed}</span>
        ) : (
          <>
            <button type="button" className="btn btn-ghost min-h-9 px-3 text-xs" disabled={busy} onClick={async () => {
              const next = all ? [] : ALL_PERMS;
              const before = on;
              setOn(next);
              if (!(await send({ action: "set", email, perms: next }))) setOn(before);
            }}>
              {all ? "اقفل الكل" : "افتح الكل"}
            </button>
            <button
              type="button"
              aria-pressed={free}
              title="بلا حدود: ما ينخصم منه شي، حتى لو الموقع مدفوع"
              className={`btn min-h-9 px-3 text-xs ${free ? "bg-gold text-on-gold" : "btn-ghost"}`}
              disabled={busy}
              onClick={async () => {
                const next = !free;
                setFree(next);
                if (!(await send({ action: "set", email, perms: on, unlimited: next }))) setFree(!next);
              }}
            >
              ♾️ {free ? "بلا حدود" : "يدفع"}
            </button>
            <button
              type="button"
              className="btn min-h-9 bg-red-600 px-3 text-xs text-white"
              disabled={busy}
              aria-label={`شيل ${email} من القائمة`}
              onClick={async () => confirm(`نشيل ${email} من القائمة؟ بيتقفل عليه كل شي (إلا «لأجل المهدي»).`) && (await send({ action: "remove", email })) && onRemoved?.()}
            >
              ✗ شيله
            </button>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`صلاحيات ${email}`}>
        {PERMS.map((p) => {
          const yes = fixed ? true : on.includes(p.key);
          return (
            <button
              key={p.key}
              type="button"
              title={p.hint}
              aria-pressed={yes}
              disabled={busy || !!fixed}
              onClick={() => toggle(p.key)}
              className={`chip min-h-9 border text-sm font-bold transition ${yes ? "border-teal bg-teal text-white" : "border-line opacity-70"}`}
            >
              {yes ? "✓" : "✗"} {p.label}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}
    </li>
  );
}

/** «السماح»: the whole list, and a field to add an email (it starts with everything open; untick what it shouldn't use). */
export default function AccessList({ rows, fixed }: { rows: { email: string; perms: Perm[]; unlimited?: boolean }[]; fixed: { email: string; label: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function add() {
    setBusy(true);
    setError("");
    try {
      await postJson("/api/admin/access", { action: "set", email: email.trim(), perms: ALL_PERMS });
      setEmail("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحفظ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="card flex flex-wrap gap-2 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) add();
        }}
      >
        <input className="field min-w-0 flex-1" dir="ltr" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="إيميل جديد" />
        <button className="btn btn-primary min-h-12 px-5" disabled={busy || !email.trim()}>
          + أضفه
        </button>
        {error && <p className="w-full text-sm font-bold text-red-600">{error}</p>}
      </form>
      <ul className="space-y-2">
        {fixed.map((f) => (
          <AccessRow key={f.email} email={f.email} perms={ALL_PERMS} fixed={f.label} />
        ))}
        {rows.map((r) => (
          <AccessRow key={`${r.email}:${r.perms.join(",")}:${r.unlimited ? 1 : 0}`} email={r.email} perms={r.perms} unlimited={r.unlimited} />
        ))}
      </ul>
      {!rows.length && <p className="text-center font-bold text-muted">ما فيه أحد في القائمة للحين.</p>}
    </div>
  );
}
