"use client";

import SmartCoin from "@/components/SmartCoin";
import { LIBRARY_ADDON, ONE_TIME_PASS, PLANS, fmtSar } from "@config/coins";
import { CONTACT_EMAIL } from "@config/site";

const fmt = (n: number) => fmtSar(n);

/**
 * What the coins will cost once paying is possible: the plans in one glance, nothing to press that doesn't work yet.
 * (Period and renewal choices, top-ups and the automatic top-up come back with the payment gateway.)
 */
export default function CoinsShop({
  plan, coinsPerVideo, journeyCoins, libraryUntil = null,
}: {
  plan: string | null;
  planPeriod?: string | null;
  autoTopup?: boolean;
  autoTopupSar?: number;
  /** null for the owner (no limit). */
  balance?: number | null;
  coinsPerVideo: Record<string, number>;
  journeyCoins: number;
  /** «المكتبة» (an add-on): until when it runs (null: not running). */
  libraryUntil?: string | null;
}) {
  const cheapest = Math.min(...Object.values(coinsPerVideo));
  return (
    <div className="space-y-6">
      {/* (not in the phone app: a store app may only sell through the store) */}
      <section className="card hide-in-app space-y-3 p-4">
        <h2 className="text-xl font-extrabold">🛍️ الباقات — قريبًا</h2>
        <p className="text-sm font-bold text-muted">
          الدفع من داخل الموقع يتفعّل قريبًا إن شاء الله. لين ذاك الوقت، تبي نقود؟ راسلنا: <a href={`mailto:${CONTACT_EMAIL}`} className="underline" dir="ltr">{CONTACT_EMAIL}</a>
        </p>
        <ul className="divide-y divide-line text-sm font-bold">
          {PLANS.map((p) => (
            <li key={p.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="flex items-center gap-2">
                <b className="text-base">{p.name}</b>
                {"popular" in p && p.popular && <span className="chip bg-sky-400 text-xs text-white">الأكثر طلبًا</span>}
                {plan === p.key && <span className="chip bg-teal text-xs text-white">باقتك</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-sky-500"><SmartCoin size={16} /> رصيد {fmt(p.coins)} / شهر</span>
                <span className="text-muted">≈ {Math.floor(p.coins / cheapest)} فيديو · {(p.coins / journeyCoins).toFixed(1)} فيلم</span>
                <b className="inline-flex items-center gap-1"><SmartCoin size={16} />{p.monthlySar}</b>
              </span>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><b className="text-base">{ONE_TIME_PASS.name}</b> <span className="text-xs text-muted">· {ONE_TIME_PASS.note}</span></span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sky-500"><SmartCoin size={16} /> رصيد {fmt(ONE_TIME_PASS.coins)}</span>
              <b className="inline-flex items-center gap-1"><SmartCoin size={16} />{ONE_TIME_PASS.priceSar}</b>
            </span>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span>
              <b className="text-base">📚 إضافة «{LIBRARY_ADDON.name}»</b>{" "}
              {libraryUntil ? (
                <span className="chip bg-sky-400/15 text-xs">✅ مفعّلة حتى {new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long" }).format(new Date(libraryUntil))}</span>
              ) : (
                <span className="text-xs text-muted">· أصواتك وشخصياتك وأماكنك في «الجواد الذكي!»</span>
              )}
            </span>
            <b className="inline-flex items-center gap-1"><SmartCoin size={16} />{LIBRARY_ADDON.monthlySar} / شهر</b>
          </li>
        </ul>
        <p className="text-xs font-bold text-muted">نقود الاشتراك تنضاف أول كل شهر وتنتهي بنهايته. الأسعار قبل ضريبة القيمة المضافة (١٥٪).</p>
      </section>
    </div>
  );
}
