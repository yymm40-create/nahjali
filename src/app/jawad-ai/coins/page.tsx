import SmartCoin from "@/components/SmartCoin";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GENERATORS } from "@config/jawad/generators";
import Link from "next/link";
import { LIBRARY_ADDON, SMART_COIN, fmtSar } from "@config/coins";
import { coinsOf, wasOf } from "@config/jawad/generators";
import { libraryAccess } from "@/lib/jawad/server/library-access";
import { CONTACT_EMAIL } from "@config/site";
import Riyal from "@/components/Riyal";

export const metadata = { title: "النقود الذكية" };
export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { reserve: "خصم توليد", refund: "استرداد", settle: "تسوية", grant: "إضافة من الإدارة", purchase: "شراء" };

/** The user's «النقود الذكية» inside JAWAD AI: balance, what each generation costs, and their history. */
export default async function JawadCoins() {
  const { user, owner } = await requireJawadUser("/jawad-ai/coins");
  const [balance, rt, { data: ledger }, library] = await Promise.all([
    coinBalance(user.id),
    loadRuntime(),
    createAdminClient().from("smart_coin_ledger").select("id,delta,reason,label,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    libraryAccess(user.id, owner),
  ]);
  const live = GENERATORS.filter((g) => rt.generators.find((x) => x.id === g.id)?.live || owner);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-6">
      <section className="jw-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h1 className="text-lg font-semibold">{SMART_COIN.name}</h1>
          <p className="text-sm text-jw-muted">رصيدك بالريال. كل توليد يُخصم بسعره المعروض على زر «توليد»، والتوليد الفاشل يُعاد رصيده تلقائيًا.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-2 text-3xl font-bold tabular-nums">
            <SmartCoin size={30} />
            {owner ? <span dir="ltr">∞</span> : <Riyal halalas={balance ?? 0} size={30} />}
          </p>
          {!owner && <Link href="/jawad-ai/credits" className="rounded-2xl bg-gradient-to-b from-amber-300 to-orange-500 px-5 py-3 text-base font-bold text-[#2a1200] shadow-lg">💳 اشحن رصيدك</Link>}
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
        <h2 className="mb-3 font-semibold">الأسعار الحالية</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {live.map((g) => (
            <div key={g.id} className="rounded-lg border border-jw-line p-3">
              <p className="mb-2 font-medium" dir="ltr" style={{ textAlign: "right" }}>{rt.generators.find((x) => x.id === g.id)?.name ?? g.name}</p>
              <ul className="space-y-1 text-sm">
                {g.priceKeys.map((k) => {
                  const c = rt.prices[g.id]?.[k.key];
                  return (
                    <li key={k.key} className="flex justify-between gap-2">
                      <span className="text-jw-muted">{k.label}</span>
                      <span className="tabular-nums" dir="ltr">{c == null ? "—" : (<><Riyal halalas={coinsOf(c)} size={14} />{wasOf(c) > coinsOf(c) && <s className="ms-1 text-xs text-jw-faint">{fmtSar(wasOf(c))}</s>}</>)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!live.length && <p className="text-sm text-jw-muted">لا توجد مولدات متاحة حاليًا.</p>}
        </div>
        <p className="mt-3 text-xs text-jw-faint">الأسعار بالريال، مقرّبة لأعلى إلى أقرب نصف ريال. المشطوب هو السعر الأصلي قبل خصم الانطلاقة.<span className="hide-in-app"> شحن الرصيد غير متاح من داخل المنصة حاليًا؛ للاستفسار: <span dir="ltr">{CONTACT_EMAIL}</span></span></p>
      </section>

      <section className="jw-panel p-5">
        <h2 className="mb-3 font-semibold">السجل</h2>
        {!ledger?.length ? (
          <p className="text-sm text-jw-muted">لا توجد حركات بعد.</p>
        ) : (
          <ul className="divide-y divide-jw-line text-sm">
            {ledger.map((r) => (
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
