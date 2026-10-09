import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { coinBalance, coinsRequired } from "@/lib/coins";
import SmartCoin from "@/components/SmartCoin";
import { IMAGE_ESTIMATE_USD } from "@/lib/film/images";
import { SMART_COIN, coinsFor, fmtSar } from "@config/coins";
import { loadPricing } from "@/lib/coins";
import CoinsShop from "./CoinsShop";
import { VIDEO_MODELS, VIDEO_RESOLUTIONS, videoEstimateUsd, type VideoModel, type VideoResolution } from "@config/film";
import { isAdmin } from "@config/site";

export const metadata = { title: "النقود الذكية | نهج علي" };
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = { grant: "إضافة", reserve: "حجز", settle: "تسوية", refund: "إرجاع", purchase: "شراء" };

/** «النقود الذكية»: the user's balance, what each operation costs, the packages and the history. */
/** The end of an add-on that is still running (null when it isn't). */
const runningUntil = (v: unknown) => (typeof v === "string" && new Date(v).getTime() > Date.now() ? v : null);

export default async function CoinsPage() {
  const user = await requireUser("/coins");
  await loadPricing();
  const [balance, required, ledger, walletRow] = await Promise.all([
    coinBalance(user.id),
    coinsRequired(),
    createAdminClient().from("smart_coin_ledger").select("delta,reason,label,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    createAdminClient().from("smart_coin_wallets").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  const wallet = walletRow.data as Record<string, unknown> | null;
  // A full film (2 edits per stage, two 10 s 480p videos on Seedance 2.5), as on the pricing calculator
  const journeyCoins =
    8 * coinsFor(0.12) + 12 * coinsFor(0.12) + 2 * coinsFor(IMAGE_ESTIMATE_USD.test) + 6 * coinsFor(IMAGE_ESTIMATE_USD.sheet) + 8 * coinsFor(0.15) +
    2 * coinsFor(videoEstimateUsd("seedance-2.5", "480p", 10));
  const owner = isAdmin(user.email);
  const prices: [string, number][] = [
    ["رد السيناريست أو صانع الشيت (تقريبًا)", coinsFor(0.12)],
    ["رد المخرج (تقريبًا)", coinsFor(0.15)],
    ["صورة اختبار ستايل", coinsFor(IMAGE_ESTIMATE_USD.test)],
    ["صورة شيت", coinsFor(IMAGE_ESTIMATE_USD.sheet)],
  ];

  return (
    <div className="space-y-6">
      <section className="card space-y-2 p-6 text-center">
        <SmartCoin size={56} className="mx-auto" />
        <h1 className="display text-4xl">{SMART_COIN.name}</h1>
        <p className="display text-5xl text-sky-500" dir="ltr">{owner ? "∞" : `${fmtSar(balance ?? 0)} ر.س`}</p>
        <p className="text-sm font-bold text-muted">
          {owner ? "أنت صاحب الموقع: بدون حد." : required ? "رصيدك بالريال: كل عملية تنخصم من رصيدك بسعرها، والعملية اللي تفشل ترجع لك." : "حاليًا الاستخدام مجاني في فترة التجربة، وما ينخصم شي من رصيدك."}
        </p>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">كم تكلف كل عملية؟</h2>
        <ul className="space-y-1 text-sm font-bold">
          {prices.map(([label, coins]) => (
            <li key={label} className="flex justify-between gap-2">
              <span>{label}</span>
              <span className="flex items-center gap-1" dir="ltr"><SmartCoin size={16} />{fmtSar(coins)} ر.س</span>
            </li>
          ))}
        </ul>
        <h3 className="font-extrabold">الفيديو (لكل ٥ ثواني · لكل ١٠ ثواني)</h3>
        <div className="overflow-hidden rounded-2xl border border-line text-sm font-bold">
          {(Object.keys(VIDEO_MODELS) as VideoModel[]).map((m) =>
            (Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[]).map((q) => (
              <div key={`${m}-${q}`} className="flex justify-between gap-2 border-b border-line p-2 last:border-0">
                <span dir="ltr">{VIDEO_MODELS[m].label} · {q}</span>
                <span className="flex items-center gap-1" dir="ltr">
                  <SmartCoin size={16} />{fmtSar(coinsFor(videoEstimateUsd(m, q, 5)))} · {fmtSar(coinsFor(videoEstimateUsd(m, q, 10)))} ر.س
                </span>
              </div>
            )),
          )}
        </div>
        <p className="text-xs font-bold text-muted">الرد الطويل أو الفيديو الأطول ياخذ أكثر؛ الخصم النهائي حسب التكلفة الفعلية للعملية.</p>
      </section>

      <CoinsShop
        plan={(wallet?.plan as string | null) ?? null}
        planPeriod={(wallet?.plan_period as string | null) ?? null}
        autoTopup={Boolean(wallet?.auto_topup)}
        autoTopupSar={Number(wallet?.auto_topup_sar ?? 50)}
        libraryUntil={runningUntil(wallet?.library_until)}
        balance={owner ? null : (balance ?? 0)}
        coinsPerVideo={{
          "2.0 · 480p": coinsFor(videoEstimateUsd("seedance-2.0", "480p", 10)),
          "2.5 · 480p": coinsFor(videoEstimateUsd("seedance-2.5", "480p", 10)),
          "2.5 · 720p": coinsFor(videoEstimateUsd("seedance-2.5", "720p", 10)),
        }}
        journeyCoins={journeyCoins}
      />

      {(ledger.data ?? []).length > 0 && (
        <section className="card space-y-2 p-4">
          <h2 className="text-xl font-extrabold">آخر الحركات</h2>
          {(ledger.data ?? []).map((r, i) => (
            <div key={i} className="flex justify-between gap-2 text-sm font-bold">
              <span>{REASONS[r.reason] ?? r.reason}{r.label ? ` · ${r.label}` : ""}</span>
              <span className={r.delta >= 0 ? "text-teal" : "text-red-500"} dir="ltr">{r.delta > 0 ? "+" : "-"}{fmtSar(Math.abs(r.delta))} ر.س</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
