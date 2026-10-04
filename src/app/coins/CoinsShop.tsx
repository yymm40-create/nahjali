"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import SmartCoin from "@/components/SmartCoin";
import { AUTO_TOP_UP, ONE_TIME_PASS, PLANS, TOP_UP, topUpCoins, yearlyPrice } from "@config/coins";

const fmt = (n: number) => n.toLocaleString("en");

/**
 * Subscriptions (monthly or yearly), the one-time pass, extra coins for المبدع / الاستوديو, and the automatic
 * top-up. Paying is enabled once the payment gateway is connected; until then the buttons say so.
 */
export default function CoinsShop({
  plan, planPeriod, autoTopup, autoTopupSar, balance, coinsPerVideo, journeyCoins,
}: {
  plan: string | null;
  planPeriod: string | null;
  autoTopup: boolean;
  autoTopupSar: number;
  /** null for the owner (no limit). */
  balance: number | null;
  coinsPerVideo: Record<string, number>;
  journeyCoins: number;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<"monthly" | "yearly">(planPeriod === "yearly" ? "yearly" : "monthly");
  const [renews, setRenews] = useState(true);
  const [topUp, setTopUp] = useState(50);
  const [auto, setAuto] = useState(autoTopup);
  const [autoSar, setAutoSar] = useState(AUTO_TOP_UP.amountsSar.includes(autoTopupSar as never) ? autoTopupSar : 50);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const canTopUp = PLANS.some((p) => p.key === plan && p.topUps);

  async function saveAuto(on: boolean, amount: number) {
    if (on && !window.confirm(
      `⚠️ تنبيه مهم جدًا\n\nبتفعيل الشحن التلقائي، كل ما نزل رصيدك تحت ${AUTO_TOP_UP.belowCoins} نقدة ذكية، ينسحب ${amount} ريال مباشرة من بطاقتك أو حسابك البنكي بدون ما نسألك مرة ثانية.\n\nهل أنت متأكد إنك تبي تفعّله؟`,
    )) return;
    setBusy(true);
    setMsg("");
    try {
      await postJson("/api/coins", { action: "auto_topup", on, amountSar: amount });
      setAuto(on);
      setAutoSar(amount);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Subscriptions */}
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">الاشتراكات</h2>
        <div className="grid grid-cols-2 gap-2">
          {([["monthly", "💳 شهري", "تدفع كل شهر"], ["yearly", "📅 سنوي", "خصم، وتدفع السنة كاملة مرة وحدة"]] as const).map(([k, label, hint]) => (
            <button
              key={k}
              className={`rounded-2xl border-2 p-3 text-start ${period === k ? "border-sky-400 bg-sky-400/10" : "border-line"}`}
              onClick={() => setPeriod(k)}
              aria-pressed={period === k}
            >
              <span className="block text-lg font-extrabold">{label}</span>
              <span className="block text-xs font-bold text-muted">{hint}</span>
            </button>
          ))}
        </div>
        {period === "monthly" && (
          <div className="grid grid-cols-2 gap-2">
            {([[true, "🔁 يتجدد كل شهر", "ينسحب المبلغ أول كل شهر لين توقفه"], [false, "1️⃣ شهر واحد بس", "ما يتجدد؛ بعد الشهر يوقف"]] as const).map(([on, label, hint]) => (
              <button
                key={label}
                className={`rounded-2xl border-2 p-2 text-start ${renews === on ? "border-sky-400 bg-sky-400/10" : "border-line"}`}
                onClick={() => setRenews(on)}
                aria-pressed={renews === on}
              >
                <span className="block text-sm font-extrabold">{label}</span>
                <span className="block text-xs font-bold text-muted">{hint}</span>
              </button>
            ))}
          </div>
        )}
        <p className="rounded-2xl bg-surface-2 p-3 text-sm font-bold">
          ⏳ نقود الاشتراك تنضاف أول كل شهر، و<span className="text-red-500">اللي ما تستخدمها تنتهي بنهاية الشهر</span> وما تنتقل للشهر اللي بعده.
        </p>

        <div className="space-y-3">
          {PLANS.map((p) => {
            const y = yearlyPrice(p.monthlySar);
            const mine = plan === p.key;
            return (
              <article key={p.key} className={`card space-y-3 p-4 ${"popular" in p && p.popular ? "border-2 border-sky-400" : ""}`}>
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xl font-extrabold">{p.name}</h3>
                  <span className="flex gap-1">
                    {"popular" in p && p.popular && <span className="chip bg-sky-400 text-xs text-white">الأكثر طلبًا</span>}
                    {mine && <span className="chip bg-teal text-xs text-white">باقتك</span>}
                  </span>
                </header>
                {period === "monthly" ? (
                  <p><span className="display text-4xl">{p.monthlySar}</span> <span className="font-bold text-muted">ر.س / شهر</span></p>
                ) : (
                  <div className="space-y-1">
                    <p>
                      <span className="display text-4xl">{fmt(y.total)}</span> <span className="font-bold text-muted">ر.س تدفعها مرة وحدة للسنة كاملة</span>
                    </p>
                    <p className="text-sm font-bold">
                      يعادل <span className="text-sky-500">{y.perMonth} ر.س / شهر</span> بدل {p.monthlySar} · توفّر {y.savePct}٪ ({fmt(p.monthlySar * 12 - y.total)} ر.س بالسنة)
                    </p>
                  </div>
                )}
                <p className="flex items-center gap-1 text-lg font-extrabold text-sky-500"><SmartCoin size={20} /> {fmt(p.coins)} نقدة ذكية كل شهر</p>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-3 text-xs font-bold">
                  <span className="col-span-2 text-sm font-extrabold">وش تقدر تصنع كل شهر:</span>
                  {Object.entries(coinsPerVideo).map(([label, c]) => (
                    <span key={label}>🎬 {Math.floor(p.coins / c)} فيديو ١٠ ثواني <span dir="ltr">({label})</span></span>
                  ))}
                  <span>🎞️ {(p.coins / journeyCoins).toFixed(1)} رحلة فيلم كاملة</span>
                </div>
                <ul className="space-y-1 text-sm font-bold">
                  {p.features.map((f) => <li key={f}>✓ {f}</li>)}
                </ul>
                <button className="btn btn-primary w-full" disabled>
                  {period === "monthly" ? `اشترك شهري${renews ? "" : " (شهر واحد)"} · ${p.monthlySar} ر.س` : `اشترك سنوي · ${fmt(y.total)} ر.س للسنة`} — قريبًا
                </button>
              </article>
            );
          })}
        </div>

        <div className="card flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="font-extrabold">{ONE_TIME_PASS.name}: {ONE_TIME_PASS.priceSar} ر.س</p>
            <p className="text-xs font-bold text-muted">{ONE_TIME_PASS.coins} نقدة · {ONE_TIME_PASS.note}</p>
          </div>
          <button className="btn btn-ghost text-sm" disabled>اشترِ — قريبًا</button>
        </div>
        <p className="text-xs font-bold text-muted">الأسعار قبل ضريبة القيمة المضافة (١٥٪).</p>
      </section>

      {/* Extra coins: subscribers of المبدع / الاستوديو */}
      <section className="card space-y-3 p-4">
        <h2 className="flex items-center gap-2 text-xl font-extrabold"><SmartCoin size={22} /> شحن نقود إضافية</h2>
        {canTopUp ? (
          <>
            <div className="flex items-center justify-between font-extrabold">
              <span>{topUp} ر.س</span>
              <span className="flex items-center gap-1 text-sky-500" dir="ltr"><SmartCoin size={18} />{fmt(topUpCoins(topUp))}</span>
            </div>
            <input type="range" className="w-full accent-sky-400" dir="ltr" min={TOP_UP.minSar} max={TOP_UP.maxSar} step={TOP_UP.stepSar} value={topUp} onChange={(e) => setTopUp(Number(e.target.value))} />
            <div className="flex justify-between text-xs font-bold text-muted" dir="ltr"><span>{TOP_UP.minSar} ر.س</span><span>{TOP_UP.maxSar} ر.س</span></div>
            <p className="text-xs font-bold text-muted">النقود الإضافية ما تنتهي بنهاية الشهر.</p>
            <button className="btn btn-primary w-full" disabled>اشحن {topUp} ر.س — قريبًا</button>
          </>
        ) : (
          <p className="text-sm font-bold text-muted">🔒 الشحن الإضافي (من {TOP_UP.minSar} لين {TOP_UP.maxSar} ريال) لمشتركي باقة «المبدع» و«الاستوديو».</p>
        )}
      </section>

      {/* Automatic top-up */}
      {balance !== null && (
        <section className="card space-y-3 p-4">
          <h2 className="text-xl font-extrabold">🔁 الشحن التلقائي</h2>
          <p className="text-sm font-bold">لما ينزل رصيدك تحت <span className="text-sky-500">{AUTO_TOP_UP.belowCoins} نقدة</span>، نشحن لك تلقائيًا المبلغ اللي تختاره.</p>
          <div className="rounded-2xl border-2 border-red-500 bg-red-500/10 p-3 text-sm font-extrabold text-red-500">
            ⚠️ تحذير: الشحن التلقائي يسحب المبلغ مباشرة من بطاقتك أو حسابك البنكي، بدون ما نسألك كل مرة. لا تفعّله إلا إذا كنت متأكد، وتقدر توقفه من هنا أي وقت.
          </div>
          <div className="flex flex-wrap gap-2">
            {AUTO_TOP_UP.amountsSar.map((a) => (
              <button
                key={a}
                className={`chip ${autoSar === a ? "bg-sky-400 text-white" : ""}`}
                disabled={busy}
                onClick={() => (auto ? saveAuto(true, a) : setAutoSar(a))}
              >
                {a} ر.س · {topUpCoins(a)} نقدة
              </button>
            ))}
          </div>
          <button className={`btn w-full ${auto ? "btn-ghost" : "btn-secondary"}`} disabled={busy} onClick={() => saveAuto(!auto, autoSar)}>
            {auto ? `⏸️ أوقف الشحن التلقائي (مفعّل: ${autoSar} ر.س)` : `فعّل الشحن التلقائي · ${autoSar} ر.س`}
          </button>
          <p className="text-xs font-bold text-muted">يشتغل فعليًا أول ما يتفعّل الدفع في الموقع وتحفظ بطاقتك.</p>
          {msg && <p className="error-box">{msg}</p>}
        </section>
      )}
    </div>
  );
}

