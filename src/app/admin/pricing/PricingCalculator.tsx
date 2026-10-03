"use client";

import { useMemo, useState } from "react";
import { VIDEO_MODELS, VIDEO_RESOLUTIONS, videoEstimateUsd, type VideoModel, type VideoResolution } from "@config/film";

const SAR = 3.75; // USD → SAR (pegged)
const sar = (n: number) => `${n.toFixed(2)} ر.س`;

/** Unit costs in USD (estimates; the owner can edit them, or take the real average). */
const UNIT_DEFAULTS = {
  screenwriter: { label: "رد السيناريست", usd: 0.12, op: "screenwriter" },
  sheets: { label: "رد صانع الشيت", usd: 0.12, op: "sheets" },
  director: { label: "رد المخرج", usd: 0.15, op: "director" },
  styleTest: { label: "صورة اختبار ستايل", usd: 0.07, op: "" },
  sheetImage: { label: "صورة شيت (2048×1152 عالية)", usd: 0.4, op: "sheet_image" },
  bookletImage: { label: "صورة كتيب (جودة متوسطة)", usd: 0.05, op: "" },
} as const;
type Unit = keyof typeof UNIT_DEFAULTS;

const MARKUP_PRESETS = [30, 50, 100, 150, 200, 300];
const MARGIN_PRESETS = [30, 40, 50, 60, 70, 80];

export default function PricingCalculator({ real }: { real: Record<string, { avg: number; count: number }> }) {
  // ── unit costs
  const [units, setUnits] = useState<Record<Unit, number>>(() =>
    Object.fromEntries(Object.entries(UNIT_DEFAULTS).map(([k, u]) => [k, u.usd])) as Record<Unit, number>,
  );
  // ── film journey scenario
  const [s, setS] = useState({
    scriptReplies: 6, sheetsReplies: 10, directorReplies: 6, edits: 2, styleTests: 2, sheets: 6,
    videos: 2, seconds: 10, model: "seedance-2.5" as VideoModel, quality: "480p" as VideoResolution,
    bookletImages: 1.5, bookletPrice: 29,
  });
  // ── profit
  const [method, setMethod] = useState<"markup" | "margin">("markup");
  const [pct, setPct] = useState(100);
  const [fee, setFee] = useState({ pct: 2.5, fixed: 1 });
  const [vat, setVat] = useState(true);
  // ── credits
  const [creditSar, setCreditSar] = useState(0.1);

  const set = (k: keyof typeof s, v: number | string) => setS({ ...s, [k]: v });

  const journey = useMemo(() => {
    const parts = [
      { label: `السيناريست: ${s.scriptReplies} ردود + ${s.edits} تعديل`, usd: (s.scriptReplies + s.edits) * units.screenwriter },
      { label: `صانع الشيت (نصوص): ${s.sheetsReplies} ردود + ${s.edits} تعديل`, usd: (s.sheetsReplies + s.edits) * units.sheets },
      { label: `صور اختبار الستايل × ${s.styleTests}`, usd: s.styleTests * units.styleTest },
      { label: `صور الشيتات (الماستر + الشخصيات والأماكن) × ${s.sheets}`, usd: s.sheets * units.sheetImage },
      { label: `المخرج: ${s.directorReplies} ردود + ${s.edits} تعديل`, usd: (s.directorReplies + s.edits) * units.director },
      {
        label: `الفيديو: ${s.videos} × ${s.seconds} ثانية · ${VIDEO_MODELS[s.model].label} · ${s.quality}`,
        usd: s.videos * videoEstimateUsd(s.model, s.quality, s.seconds),
      },
    ];
    return { parts, usd: parts.reduce((a, p) => a + p.usd, 0) };
  }, [s, units]);

  const oneVideo = videoEstimateUsd(s.model, s.quality, s.seconds);
  const products = [
    { label: "🎬 رحلة فيلم كاملة (حسب السيناريو فوق)", costSar: journey.usd * SAR },
    { label: `🎞️ فيديو واحد (${s.seconds} ثانية · ${s.quality} · ${VIDEO_MODELS[s.model].label})`, costSar: oneVideo * SAR },
    { label: "✍️ السيناريست (رحلة كاملة)", costSar: (s.scriptReplies + s.edits) * units.screenwriter * SAR },
    { label: "🎨 صانع الشيت (نصوص + صور)", costSar: ((s.sheetsReplies + s.edits) * units.sheets + s.styleTests * units.styleTest + s.sheets * units.sheetImage) * SAR },
    { label: "🎥 المخرج (بدون فيديو)", costSar: (s.directorReplies + s.edits) * units.director * SAR },
    { label: "📖 كتيب نهج علي", costSar: s.bookletImages * units.bookletImage * SAR },
  ];

  /**
   * Price before VAT so that, after the payment fee, the profit matches the chosen rule:
   *   markup  → profit = cost × pct      (نسبة إضافة على التكلفة)
   *   margin  → profit = price × pct     (هامش من سعر البيع، الطريقة المعتمدة عالميًا)
   */
  const price = (cost: number) => {
    const f = fee.pct / 100;
    if (method === "markup") return (cost * (1 + pct / 100) + fee.fixed) / (1 - f);
    const m = pct / 100;
    return m + f >= 1 ? NaN : (cost + fee.fixed) / (1 - f - m);
  };
  const row = (cost: number) => {
    const net = price(cost);
    const gateway = net * (fee.pct / 100) + fee.fixed;
    const v = vat ? net * 0.15 : 0;
    const profit = net - cost - gateway;
    return { net, v, final: net + v, gateway, profit, margin: net > 0 ? (profit / net) * 100 : 0 };
  };

  const packages = [
    { name: "باقة البداية", priceSar: 39 },
    { name: "باقة المبدع", priceSar: 99 },
    { name: "باقة الاستوديو", priceSar: 249 },
  ];
  const journeyFinal = row(journey.usd * SAR);

  const num = (v: number, on: (n: number) => void, step = 1, w = "w-20") => (
    <input className={`field min-h-9 ${w} text-center`} dir="ltr" type="number" step={step} min={0} value={v} onChange={(e) => on(Number(e.target.value))} />
  );

  return (
    <div className="space-y-6">
      {/* 1. Unit costs */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">١. التكلفة الأساسية لكل وحدة</h2>
        <p className="text-xs font-bold text-muted">بالدولار كما تحسبها الشركات، وجنبها بالريال. «الفعلي» = متوسط الموقع إلى الآن.</p>
        {(Object.keys(UNIT_DEFAULTS) as Unit[]).map((k) => {
          const r = UNIT_DEFAULTS[k].op ? real[UNIT_DEFAULTS[k].op] : undefined;
          return (
            <div key={k} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-2 text-sm font-bold">
              <span>{UNIT_DEFAULTS[k].label}</span>
              <span className="flex items-center gap-2">
                <span dir="ltr">$</span>
                {num(units[k], (n) => setUnits({ ...units, [k]: n }), 0.01)}
                <span className="text-muted">= {sar(units[k] * SAR)}</span>
                {r && r.count > 0 && (
                  <button className="chip" onClick={() => setUnits({ ...units, [k]: Number(r.avg.toFixed(3)) })} title={`${r.count} عملية`}>
                    الفعلي ${r.avg.toFixed(3)}
                  </button>
                )}
              </span>
            </div>
          );
        })}
        <div className="space-y-1 rounded-xl bg-surface-2 p-2 text-sm font-bold">
          <p>الفيديو لكل ١٠ ثواني (من أسعار BytePlus):</p>
          {(Object.keys(VIDEO_MODELS) as VideoModel[]).map((m) => (
            <p key={m} className="text-xs text-muted" dir="auto">
              {VIDEO_MODELS[m].label}: {(Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[]).map((q) => `${q} ${sar(videoEstimateUsd(m, q, 10) * SAR)}`).join(" · ")}
            </p>
          ))}
        </div>
      </section>

      {/* 2. Film journey */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">٢. تكلفة رحلة فيلم كاملة</h2>
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          {([
            ["scriptReplies", "ردود السيناريست"], ["sheetsReplies", "ردود صانع الشيت"], ["directorReplies", "ردود المخرج"],
            ["edits", "تعديلات لكل مرحلة"], ["styleTests", "صور اختبار الستايل"], ["sheets", "صور الشيتات"],
            ["videos", "عدد الفيديوهات"], ["seconds", "ثواني كل فيديو"],
          ] as [keyof typeof s, string][]).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2">
              <span>{label}</span>
              {num(s[k] as number, (n) => set(k, n))}
            </label>
          ))}
          <label className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2">
            <span>النسخة</span>
            <select className="field min-h-9 w-32" value={s.model} onChange={(e) => set("model", e.target.value)}>
              {(Object.keys(VIDEO_MODELS) as VideoModel[]).map((m) => <option key={m} value={m}>{VIDEO_MODELS[m].label}</option>)}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-2">
            <span>الجودة</span>
            <select className="field min-h-9 w-24" value={s.quality} onChange={(e) => set("quality", e.target.value)}>
              {(Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[]).map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </label>
        </div>
        <ul className="space-y-1 text-sm font-bold">
          {journey.parts.map((p) => (
            <li key={p.label} className="flex justify-between gap-2">
              <span>{p.label}</span>
              <span dir="ltr">{sar(p.usd * SAR)}</span>
            </li>
          ))}
        </ul>
        <p className="flex justify-between rounded-xl bg-gold/10 p-3 text-lg font-extrabold">
          <span>تكلفة الرحلة عليك</span>
          <span dir="ltr">{sar(journey.usd * SAR)} (${journey.usd.toFixed(2)})</span>
        </p>
      </section>

      {/* 3. Profit */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">٣. نسبة الربح والسعر النهائي</h2>
        <div className="grid grid-cols-2 gap-2">
          {([["markup", "نسبة إضافة على التكلفة", "التكلفة × (١ + النسبة)"], ["margin", "هامش من سعر البيع (عالمي)", "الربح = نسبة من السعر"]] as const).map(([k, label, hint]) => (
            <button key={k} className={`rounded-2xl border-2 p-2 text-start ${method === k ? "border-gold bg-gold/10" : "border-line"}`} onClick={() => { setMethod(k); setPct(k === "markup" ? 100 : 50); }}>
              <span className="block text-sm font-extrabold">{label}</span>
              <span className="block text-xs font-bold text-muted">{hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(method === "markup" ? MARKUP_PRESETS : MARGIN_PRESETS).map((p) => (
            <button key={p} className={`chip ${pct === p ? "bg-gold text-on-gold" : ""}`} onClick={() => setPct(p)} dir="ltr">{p}%</button>
          ))}
          <label className="flex items-center gap-1 text-sm font-bold">نسبة خاصة {num(pct, setPct)}<span dir="ltr">%</span></label>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
          <label className="flex items-center gap-1">رسوم بوابة الدفع {num(fee.pct, (n) => setFee({ ...fee, pct: n }), 0.1, "w-16")}<span dir="ltr">%</span> + {num(fee.fixed, (n) => setFee({ ...fee, fixed: n }), 0.5, "w-16")} ر.س</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="size-5" checked={vat} onChange={(e) => setVat(e.target.checked)} />ضريبة القيمة المضافة ١٥٪ (على العميل)</label>
        </div>
        <div className="space-y-2">
          {products.map((p) => {
            const r = row(p.costSar);
            return (
              <div key={p.label} className="space-y-1 rounded-2xl border border-line p-3 text-sm font-bold">
                <p className="font-extrabold">{p.label}</p>
                {Number.isNaN(r.net) ? (
                  <p className="text-red-500">الهامش مع رسوم الدفع لازم يكون أقل من ١٠٠٪.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <span className="text-muted">التكلفة عليك</span><span dir="ltr">{sar(p.costSar)}</span>
                    <span className="text-muted">السعر قبل الضريبة</span><span dir="ltr">{sar(r.net)}</span>
                    {vat && (<><span className="text-muted">الضريبة</span><span dir="ltr">{sar(r.v)}</span></>)}
                    <span className="font-extrabold">السعر النهائي للعميل</span><span className="font-extrabold" dir="ltr">{sar(r.final)}</span>
                    <span className="text-muted">رسوم الدفع</span><span dir="ltr">{sar(r.gateway)}</span>
                    <span className="font-extrabold text-teal">ربحك الصافي</span><span className="font-extrabold text-teal" dir="ltr">{sar(r.profit)} ({r.margin.toFixed(0)}%)</span>
                  </div>
                )}
                {p.label.startsWith("📖") && (
                  <p className="text-xs text-muted">سعره الحالي {s.bookletPrice} ر.س → ربحك تقريبًا {sar(s.bookletPrice / (vat ? 1.15 : 1) * (1 - fee.pct / 100) - fee.fixed - p.costSar)}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Credits */}
      <section className="card space-y-3 p-4">
        <h2 className="text-xl font-extrabold">٤. الرصيد (Credits) والباقات</h2>
        <p className="text-xs font-bold text-muted">مثل Higgsfield وRunway وKling: العميل يشتري رصيد، وكل عملية تخصم حسب تكلفتها. سعر الرصيد يشمل ربحك ورسوم الدفع (قبل الضريبة).</p>
        <label className="flex items-center gap-2 text-sm font-bold">سعر الرصيد الواحد للعميل {num(creditSar, setCreditSar, 0.01)} ر.س</label>
        <div className="space-y-1 text-sm font-bold">
          {products.map((p) => {
            const r = row(p.costSar);
            return (
              <p key={p.label} className="flex justify-between gap-2">
                <span>{p.label}</span>
                <span dir="ltr">{Number.isNaN(r.net) ? "—" : `${Math.ceil(r.net / creditSar)} رصيد`}</span>
              </p>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {packages.map((pk) => {
            const net = vat ? pk.priceSar / 1.15 : pk.priceSar;
            const credits = Math.floor(net / creditSar);
            const journeys = Number.isNaN(journeyFinal.net) ? 0 : net / journeyFinal.net;
            return (
              <div key={pk.name} className="space-y-1 rounded-2xl border border-line p-3 text-center text-sm font-bold">
                <p className="font-extrabold">{pk.name}</p>
                <p className="display text-2xl" dir="ltr">{pk.priceSar} ر.س</p>
                <p>{credits} رصيد</p>
                <p className="text-xs text-muted">≈ {journeys.toFixed(1)} رحلة فيلم</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
