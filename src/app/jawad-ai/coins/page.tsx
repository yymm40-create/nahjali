import SmartCoin from "@/components/SmartCoin";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadCreditSettings } from "@/lib/credits/settings";
import Link from "next/link";
import { LIBRARY_ADDON, SMART_COIN } from "@config/coins";
import { bonusPct } from "@config/credits";
import { libraryAccess } from "@/lib/jawad/server/library-access";
import Riyal from "@/components/Riyal";

export const metadata = { title: "النقود الذكية" };
export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { reserve: "خصم توليد", refund: "استرداد", settle: "تسوية", grant: "إضافة من الإدارة", purchase: "شراء" };

/**
 * What was spent since the last top-up (a purchase or the owner's grant): going back through the history until it, the
 * spending less what came back. The last top-up's whole = what is left + that (so the ring reads left / whole).
 */
function usedSinceTopUp(rows: { delta: number; reason: string }[], left: number) {
  let spent = 0;
  for (const r of rows) {
    if ((r.reason === "purchase" || r.reason === "grant") && r.delta > 0) break;
    spent -= r.delta;
  }
  spent = Math.max(0, spent);
  return { spent, total: left + spent };
}

/** A hollow ring that fills with what is left. */
function Ring({ pct, tone, children }: { pct: number; tone: string; children: React.ReactNode }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid size-48 place-items-center" role="img" aria-label={`باقي ${pct}٪ من رصيدك`}>
      <svg viewBox="0 0 180 180" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="90" cy="90" r={r} fill="none" stroke="var(--jw-surface-3)" strokeWidth="16" />
        <circle cx="90" cy="90" r={r} fill="none" stroke={tone} strokeWidth="16" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset .8s" }} />
      </svg>
      <div className="relative grid justify-items-center gap-0.5">{children}</div>
    </div>
  );
}

/** The user's «النقود الذكية» inside JAWAD AI: a ring of what is left from the last top-up, the history and every package. */
export default async function JawadCoins() {
  const { user, owner } = await requireJawadUser("/jawad-ai/coins");
  const [balance, credit, { data: ledger }, library] = await Promise.all([
    coinBalance(user.id),
    loadCreditSettings(),
    createAdminClient().from("smart_coin_ledger").select("id,delta,reason,label,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
    libraryAccess(user.id, owner),
  ]);
  const packs = credit.packs;
  const left = balance ?? 0;
  const { spent, total } = usedSinceTopUp(ledger ?? [], left);
  const pct = owner ? 100 : total > 0 ? Math.max(0, Math.min(100, Math.round((left / total) * 100))) : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-6">
      <section className="jw-panel flex flex-col items-center gap-5 p-6 sm:flex-row sm:justify-around">
        <Ring pct={pct} tone={pct > 40 ? "#22c55e" : pct > 15 ? "#f59e0b" : "#ef4444"}>
          <span className="text-xs text-jw-muted">باقي لك</span>
          <span className="flex items-center gap-1.5 text-2xl font-bold tabular-nums">{owner ? <span dir="ltr">∞</span> : <Riyal halalas={left} size={22} />}</span>
          {!owner && total > 0 && <span className="text-xs text-jw-muted" dir="ltr">{pct}%</span>}
        </Ring>
        <div className="w-full max-w-xs space-y-3 text-center sm:text-start">
          <h1 className="text-lg font-semibold">رصيدك من {SMART_COIN.name}</h1>
          {owner ? (
            <p className="text-sm text-jw-muted">حسابك مفتوح بلا حدود.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><i className="inline-block size-3 rounded-full" style={{ background: pct > 40 ? "#22c55e" : pct > 15 ? "#f59e0b" : "#ef4444" }} />الباقي</span><Riyal halalas={left} size={14} /></li>
              <li className="flex items-center justify-between gap-3"><span className="flex items-center gap-2"><i className="inline-block size-3 rounded-full bg-jw-surface-3" />صرفت من آخر شحنة</span><Riyal halalas={spent} size={14} /></li>
              <li className="flex items-center justify-between gap-3 border-t border-jw-line pt-2 font-semibold"><span>آخر شحنة كان مجموعها</span><Riyal halalas={total} size={14} /></li>
            </ul>
          )}
          {!owner && <Link href="/jawad-ai/credits" className="block rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 px-5 py-3 text-center text-base font-bold text-[#2a1200] shadow-lg">💳 اشحن رصيدك</Link>}
          <p className="text-xs text-jw-faint">كل توليد يبين سعره على زر «توليد» قبل ما تضغط، والتوليد الفاشل يرجع رصيده.</p>
        </div>
      </section>

      <Link href="/jawad-ai/library" className="jw-panel flex flex-wrap items-center justify-between gap-3 p-5 hover:border-jw-accent/50">
        <span>
          <span className="block font-semibold">📚 «{LIBRARY_ADDON.name}»<span className="hide-in-app"> · إضافة بـ <SmartCoin size={12} className="inline align-middle" />{LIBRARY_ADDON.monthlySar} شهريًا</span></span>
          <span className="block text-sm text-jw-muted">أصواتك وشخصياتك وأماكنك محفوظة، وتمنشنها بـ «@اسمها».</span>
        </span>
        <span className={`jw-chip !px-3 !py-1 ${library.active ? "!border-jw-accent/50 text-jw-accent" : ""}`}>{owner ? "مفتوحة لك دائمًا" : library.active ? "مفعّلة" : "غير مفعّلة"}</span>
      </Link>

      <section className="jw-panel p-5">
        <h2 className="mb-3 font-semibold">الباقات</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {packs.map((p) => (
            <li key={p.id}>
              <Link href={`/jawad-ai/credits?pack=${p.id}`} className="flex h-full items-center justify-between gap-3 rounded-lg border border-jw-line p-3 hover:border-jw-accent/50">
                <span>
                  <span className="block font-medium">{p.name}{p.tag && <span className="jw-chip ms-2 !px-2 !py-0.5 text-xs">{p.tag}</span>}</span>
                  <span className="block text-xs text-jw-muted">{p.note || <>رصيد <Riyal halalas={p.credit * 100} size={12} /></>}</span>
                </span>
                <span className="flex items-center gap-1 tabular-nums"><Riyal halalas={p.price * 100} size={14} />{bonusPct(p) > 0 && <span className="ms-1 text-xs text-jw-ok">+{bonusPct(p)}٪</span>}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-jw-faint">كل الباقات متاحة لك دائمًا، حتى الأقل من اللي اشتريته قبل.</p>
      </section>

      <section className="jw-panel p-5">
        <h2 className="mb-3 font-semibold">السجل</h2>
        {!ledger?.length ? (
          <p className="text-sm text-jw-muted">لا توجد حركات بعد.</p>
        ) : (
          <ul className="divide-y divide-jw-line text-sm">
            {ledger.slice(0, 50).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  {REASON[r.reason] ?? r.reason} <span className="text-xs text-jw-muted" dir="auto">{r.label}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-jw-faint">{new Date(r.created_at).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "short", timeStyle: "short" })}</span>
                  <span className={`tabular-nums ${r.delta < 0 ? "text-jw-danger" : "text-jw-ok"}`} dir="ltr">{r.delta > 0 ? "+" : "-"}<Riyal halalas={Math.abs(r.delta)} size={14} /></span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
