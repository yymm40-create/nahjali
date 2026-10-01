"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

interface Tier {
  key: string;
  label: string;
  description: string;
  price_halalas: number;
}

interface Props {
  templates: { id: string; name: string; pages: number }[];
  tiers: Tier[];
  defaultQuality: string;
  freeTrial: boolean;
  trialsLeft: number | null;
  pendingOrder: { id: string; amount_halalas: number } | null;
  devPayment: boolean;
}

const sar = (halalas: number) => `${halalas / 100} ريال`;

export default function NewOrder({ templates, tiers, defaultQuality, freeTrial, trialsLeft, pendingOrder, devPayment }: Props) {
  const router = useRouter();
  const [template, setTemplate] = useState(templates[0]?.id ?? "");
  const [quality, setQuality] = useState(defaultQuality);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const createOrder = () =>
    run(async () => {
      const { next } = await postJson<{ id: string; next: string }>("/api/orders", { templateId: template, quality });
      router.push(next);
    });

  const pay = () =>
    run(async () => {
      await postJson(`/api/orders/${pendingOrder!.id}/dev-pay`);
      router.push(`/order/${pendingOrder!.id}/upload`);
    });

  // Paid mode only: payment step for an existing order
  if (pendingOrder) {
    return (
      <div className="card space-y-5 p-6">
        <h1 className="display text-4xl">الدفع</h1>
        <div className="flex items-center justify-between rounded-2xl border-[3px] border-ink bg-sun p-4 text-xl font-extrabold">
          <span>المبلغ</span>
          <span>{sar(pendingOrder.amount_halalas)}</span>
        </div>
        {devPayment ? (
          <>
            <p className="rounded-2xl border-[3px] border-dashed border-ink p-3 text-sm font-bold">
              وضع التطوير: الدفع الحقيقي (Moyasar) غير مربوط بعد. هذا الزر يعتبر الطلب مدفوع للتجربة فقط، ولا يشتغل في الموقع الحقيقي.
            </p>
            <button className="btn btn-primary w-full" onClick={pay} disabled={busy}>
              {busy ? "لحظة…" : "دفع تجريبي"}
            </button>
          </>
        ) : (
          <p className="error-box">الدفع غير متاح حاليًا. جرّب لاحقًا.</p>
        )}
        {error && <p className="error-box">{error}</p>}
      </div>
    );
  }

  const noTrialsLeft = freeTrial && trialsLeft === 0;
  const selectedTier = tiers.find((t) => t.key === quality);

  return (
    <div className="space-y-6">
      {freeTrial && (
        <div className="card -rotate-1 bg-lime p-4 text-center">
          <p className="display text-2xl">النسخة التجريبية مجانية 🎉</p>
          <p className="font-bold">
            {noTrialsLeft ? "استخدمت كل تجاربك المجانية." : `باقي لك ${trialsLeft} ${trialsLeft === 1 ? "تجربة" : "تجارب"} مجانية.`}
          </p>
        </div>
      )}

      <section className="space-y-3">
        <h1 className="display text-3xl">١. اختر الكتيب</h1>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setTemplate(t.id)}
            className={`card flex w-full items-center gap-4 p-4 text-right transition ${template === t.id ? "bg-sun" : ""}`}
          >
            <Image src={`/templates/${t.id}/page-01.jpg`} alt="" width={80} height={113} className="rounded-xl border-[3px] border-ink" />
            <div>
              <h2 className="text-xl font-extrabold">{t.name}</h2>
              <p className="font-bold text-ink/70">{t.pages} صفحات ملوّنة جاهزة للطباعة</p>
            </div>
          </button>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="display text-3xl">٢. اختر الجودة</h2>
        <div className="space-y-3" role="radiogroup" aria-label="الجودة">
          {tiers.map((t) => {
            const active = quality === t.key;
            return (
              <button
                key={t.key}
                role="radio"
                aria-checked={active}
                onClick={() => setQuality(t.key)}
                className={`card flex w-full items-center justify-between gap-3 p-4 text-right transition ${active ? "bg-grape text-white" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full border-[3px] ${active ? "border-white" : "border-ink"}`}>
                    {active && <span className="size-3 rounded-full bg-white" />}
                  </span>
                  <span>
                    <span className="block text-lg font-extrabold">{t.label}</span>
                    <span className={`block text-sm font-bold ${active ? "text-white/80" : "text-ink/60"}`}>{t.description}</span>
                  </span>
                </span>
                <span className="shrink-0 text-left">
                  {freeTrial ? (
                    <>
                      <span className={`block text-sm font-bold line-through ${active ? "text-white/70" : "text-ink/50"}`}>{sar(t.price_halalas)}</span>
                      <span className="display block text-xl">مجانًا</span>
                    </>
                  ) : (
                    <span className="display block text-xl">{sar(t.price_halalas)}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-sun w-full text-xl" onClick={createOrder} disabled={busy || !template || noTrialsLeft}>
        {busy ? "لحظة…" : freeTrial ? "جرّب مجانًا" : `التالي: الدفع (${selectedTier ? sar(selectedTier.price_halalas) : ""})`}
      </button>
    </div>
  );
}
