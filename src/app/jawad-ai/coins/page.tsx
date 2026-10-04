import SmartCoin from "@/components/SmartCoin";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { GENERATORS } from "@config/jawad/generators";
import { SMART_COIN } from "@config/coins";
import { CONTACT_EMAIL } from "@config/site";

export const metadata = { title: "النقود الذكية" };
export const dynamic = "force-dynamic";

const REASON: Record<string, string> = { reserve: "خصم توليد", refund: "استرداد", settle: "تسوية", grant: "إضافة من الإدارة", purchase: "شراء" };

/** The user's «النقود الذكية» inside JAWAD AI: balance, what each generation costs, and their history. */
export default async function JawadCoins() {
  const { user, owner } = await requireJawadUser("/jawad-ai/coins");
  const [balance, rt, { data: ledger }] = await Promise.all([
    coinBalance(user.id),
    loadRuntime(),
    createAdminClient().from("smart_coin_ledger").select("id,delta,reason,label,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
  ]);
  const live = GENERATORS.filter((g) => rt.generators.find((x) => x.id === g.id)?.live || owner);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pb-16 pt-6">
      <section className="jw-panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h1 className="text-lg font-semibold">{SMART_COIN.name}</h1>
          <p className="text-sm text-jw-muted">كل توليد يُخصم بسعره المعروض على زر «توليد»، والتوليد الفاشل يُعاد رصيده تلقائيًا.</p>
        </div>
        <p className="flex items-center gap-2 text-3xl font-bold tabular-nums">
          <SmartCoin size={30} />
          <span dir="ltr">{owner ? "∞" : (balance ?? 0).toLocaleString("en")}</span>
        </p>
      </section>

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
                      <span className="tabular-nums" dir="ltr">{c == null ? "—" : (c / 100).toFixed(2).replace(/\.00$/, "")}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!live.length && <p className="text-sm text-jw-muted">لا توجد مولدات متاحة حاليًا.</p>}
        </div>
        <p className="mt-3 text-xs text-jw-faint">المجموع يُقرَّب لأعلى لأقرب نقدة. شحن الرصيد غير متاح من داخل المنصة حاليًا؛ للاستفسار: <span dir="ltr">{CONTACT_EMAIL}</span></p>
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
                  <span className="text-xs text-jw-faint">{new Date(r.created_at).toLocaleString("ar-SA-u-nu-latn", { dateStyle: "short", timeStyle: "short" })}</span>
                  <span className={`tabular-nums ${r.delta < 0 ? "text-jw-danger" : "text-jw-ok"}`} dir="ltr">{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
