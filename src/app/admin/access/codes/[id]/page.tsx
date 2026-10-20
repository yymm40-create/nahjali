import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { codeFromRow } from "@/lib/access";
import { isAdmin } from "@config/site";
import Riyal from "@/components/Riyal";

export const metadata = { title: "مراقبة كود | لوحة التحكم" };
export const dynamic = "force-dynamic";

// «📊 مراقبة الكود»: everyone who entered one code — when, what its gift put in their wallet, and from that moment on
// every operation they paid for (or, on a free code, what it would have cost): how much, on what, and when.

interface Move {
  ref: string;
  label: string;
  /** halalas: what it took from the wallet (or its value, when nothing was taken) */
  halalas: number;
  at: string;
  free: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
/** what an operation was, in a word (its label up to «·», the rest is detail) */
const sectionOf = (label: string) => label.split(" · ")[0].trim() || "بدون اسم";

export default async function CodeWatch({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("/admin/access");
  if (!isAdmin(user.email)) notFound();
  const { id } = await params;
  const db = createAdminClient();
  const { data: row } = await db.from("site_codes").select("*").eq("id", id).maybeSingle();
  if (!row) notFound();
  const code = codeFromRow(row);
  const usesRes = await db.from("site_code_uses").select("email,at,gifted_halalas").eq("code_id", id).order("at", { ascending: false });
  const uses = (usesRes.data ?? (await db.from("site_code_uses").select("email,at").eq("code_id", id)).data ?? []) as { email: string; at: string; gifted_halalas?: number }[];
  const all = uses.length ? await listAllUsers() : [];
  const idOf = new Map(all.map((u) => [String(u.email ?? "").toLowerCase(), u.id]));
  const people = uses.map((u) => ({ ...u, userId: idOf.get(u.email) ?? null }));
  const ids = people.flatMap((p) => (p.userId ? [p.userId] : []));
  const since = people.reduce((m, p) => (p.at < m ? p.at : m), new Date().toISOString());

  // every wallet move of these people since the first of them entered the code, and what free use was written down
  const [ledger, free, wallets] = ids.length
    ? await Promise.all([
        db.from("smart_coin_ledger").select("user_id,delta,reason,ref,label,created_at").in("user_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
        db.from("site_free_usage").select("user_id,ref,label,halalas,created_at").in("user_id", ids).gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
        db.from("smart_coin_wallets").select("user_id,balance").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [], error: null }, { data: [] }];
  const freeMissing = Boolean((free as { error?: unknown }).error);

  const rows = people.map((p) => {
    const moves: Move[] = [];
    // one operation = one ref: what it took in all (held, settled, given back), from the moment they entered the code
    const byRef = new Map<string, { label: string; delta: number; at: string }>();
    for (const l of (ledger.data ?? []) as { user_id: string; delta: number; reason: string; ref: string; label: string; created_at: string }[]) {
      if (l.user_id !== p.userId || l.created_at < p.at || l.reason === "grant" || l.reason === "purchase") continue;
      const k = l.ref || `${l.created_at}:${l.label}`;
      const m = byRef.get(k) ?? { label: l.label, delta: 0, at: l.created_at };
      m.delta += l.delta;
      if (l.created_at < m.at) m.at = l.created_at;
      if (!m.label) m.label = l.label;
      byRef.set(k, m);
    }
    for (const [ref, m] of byRef) if (m.delta < 0) moves.push({ ref, label: m.label, halalas: -m.delta, at: m.at, free: false });
    for (const f of (free.data ?? []) as { user_id: string; ref: string; label: string; halalas: number; created_at: string }[]) {
      if (f.user_id !== p.userId || f.created_at < p.at) continue;
      moves.push({ ref: f.ref, label: f.label, halalas: f.halalas, at: f.created_at, free: true });
    }
    moves.sort((a, b) => (a.at < b.at ? 1 : -1));
    const paid = moves.filter((m) => !m.free).reduce((s, m) => s + m.halalas, 0);
    const value = moves.filter((m) => m.free).reduce((s, m) => s + m.halalas, 0);
    const sections = new Map<string, { n: number; halalas: number }>();
    for (const m of moves) {
      const s = sections.get(sectionOf(m.label)) ?? { n: 0, halalas: 0 };
      s.n++;
      s.halalas += m.halalas;
      sections.set(sectionOf(m.label), s);
    }
    const balance = ((wallets.data ?? []) as { user_id: string; balance: number }[]).find((w) => w.user_id === p.userId)?.balance ?? null;
    return { ...p, moves, paid, value, sections: [...sections].sort((a, b) => b[1].halalas - a[1].halalas), balance, last: moves[0]?.at ?? null };
  });
  rows.sort((a, b) => b.paid + b.value - (a.paid + a.value));
  const total = { paid: rows.reduce((s, r) => s + r.paid, 0), value: rows.reduce((s, r) => s + r.value, 0), gifts: rows.reduce((s, r) => s + Number(r.gifted_halalas ?? 0), 0), ops: rows.reduce((s, r) => s + r.moves.length, 0) };

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/jawad-ai/admin/access" className="text-sm font-bold text-muted">→ السماح والأكواد</Link>
        <h1 className="display text-3xl">📊 مراقبة الكود «{code.label}»</h1>
        <p className="font-mono text-lg font-extrabold" dir="ltr">{code.code}</p>
        <p className="text-sm font-bold text-muted">
          كل شخص دخل بهذا الكود: متى دخل، كم نزل له من الهدية، ومن لحظة دخوله كل عملية سواها — كم انخصم منها، وعلى إيش، ومتى (العملية الوحدة تنحسب مرة وحدة: اللي انحجز ورجع ما ينحسب).
          {code.unlimited ? " الكود «بلا حدود»: ما ينخصم منهم شي، فتطلع قيمة كل عملية بأسعار الموقع (🎟️)." : ""}
        </p>
        {freeMissing && <p className="error-box">عشان تنحسب قيمة الاستخدام المجاني (الأكواد «بلا حدود»)، شغّل الملف <span dir="ltr">supabase/migrations/0085_free_usage.sql</span> في SQL Editor في Supabase. الاستخدام المدفوع ينعرض عادي.</p>}
      </header>

      <section className="card grid grid-cols-2 gap-3 p-4 text-center sm:grid-cols-5">
        <div><p className="text-xs font-bold text-muted">الأشخاص</p><p className="text-2xl font-extrabold">{rows.length}{code.maxUses ? ` / ${code.maxUses}` : ""}</p></div>
        <div><p className="text-xs font-bold text-muted">العمليات</p><p className="text-2xl font-extrabold">{total.ops}</p></div>
        <div><p className="text-xs font-bold text-muted">انخصم من محافظهم</p><p className="text-xl font-extrabold"><Riyal halalas={total.paid} size={16} /></p></div>
        <div><p className="text-xs font-bold text-muted">قيمة المجاني</p><p className="text-xl font-extrabold"><Riyal halalas={total.value} size={16} /></p></div>
        <div><p className="text-xs font-bold text-muted">الهدايا اللي نزلت</p><p className="text-xl font-extrabold"><Riyal halalas={total.gifts} size={16} /></p></div>
      </section>

      {!rows.length && <p className="card p-4 font-bold text-muted">ما أحد دخل بهذا الكود للحين.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.email} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <b className="min-w-0 flex-1 break-all" dir="ltr">{r.email}</b>
              <span className="text-sm font-bold">صرف: <Riyal halalas={r.paid} size={14} /></span>
              {r.value > 0 && <span className="text-sm font-bold">🎟️ قيمة مجانية: <Riyal halalas={r.value} size={14} /></span>}
              {r.balance !== null && <span className="text-sm font-bold text-muted">رصيده الحين: <Riyal halalas={r.balance} size={13} /></span>}
            </div>
            <p className="text-xs font-bold text-muted">
              دخل الكود: {fmt(r.at)}
              {Number(r.gifted_halalas ?? 0) > 0 && <> · نزل له من الهدية <Riyal halalas={Number(r.gifted_halalas)} size={12} /></>}
              {r.last ? ` · آخر استخدام: ${fmt(r.last)}` : " · ما استخدم شي للحين"}
              {!r.userId && " · (ما لقيت حسابه)"}
            </p>
            {!!r.sections.length && (
              <div className="flex flex-wrap gap-2">
                {r.sections.slice(0, 12).map(([name, s]) => (
                  <span key={name} className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-xs font-bold">
                    {name} · {s.n} مرة · <Riyal halalas={s.halalas} size={11} />
                  </span>
                ))}
              </div>
            )}
            {!!r.moves.length && (
              <details>
                <summary className="cursor-pointer text-sm font-extrabold">كل العمليات ({r.moves.length})</summary>
                <div className="mt-2 max-h-[420px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted"><th className="p-1 text-start">متى</th><th className="p-1 text-start">على إيش</th><th className="p-1 text-end">كم</th></tr>
                    </thead>
                    <tbody>
                      {r.moves.slice(0, 1000).map((m, i) => (
                        <tr key={`${m.ref}-${i}`} className="border-t border-line">
                          <td className="whitespace-nowrap p-1">{fmt(m.at)}</td>
                          <td className="p-1">{m.label || "بدون اسم"}{m.free && " 🎟️"}</td>
                          <td className="whitespace-nowrap p-1 text-end"><Riyal halalas={m.halalas} size={11} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
