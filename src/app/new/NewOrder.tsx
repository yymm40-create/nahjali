"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

interface Props {
  templates: { id: string; name: string; pages: number }[];
  pendingOrder: { id: string; amount_halalas: number } | null;
  devPayment: boolean;
}

export default function NewOrder({ templates, pendingOrder, devPayment }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(templates[0]?.id ?? "");
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
      const { id } = await postJson<{ id: string }>("/api/orders", { templateId: selected });
      router.replace(`/new?order=${id}`);
      setBusy(false);
    });

  const pay = () =>
    run(async () => {
      await postJson(`/api/orders/${pendingOrder!.id}/dev-pay`);
      router.push(`/order/${pendingOrder!.id}/upload`);
    });

  if (pendingOrder) {
    return (
      <div className="card space-y-5 p-6">
        <span className="chip">الخطوة ٢ من ٤</span>
        <h1 className="display text-4xl">الدفع</h1>
        <div className="flex items-center justify-between rounded-2xl border-[3px] border-ink bg-sun p-4 text-xl font-extrabold">
          <span>المبلغ</span>
          <span>{pendingOrder.amount_halalas / 100} ريال</span>
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

  return (
    <div className="space-y-5">
      <span className="chip">الخطوة ١ من ٤</span>
      <h1 className="display text-4xl">اختر الكتيب</h1>
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => setSelected(t.id)}
          className={`card flex w-full items-center gap-4 p-4 text-right transition ${selected === t.id ? "bg-lime" : ""}`}
        >
          <Image src={`/templates/${t.id}/page-01.jpg`} alt="" width={90} height={128} className="rounded-xl border-[3px] border-ink" />
          <div>
            <h2 className="text-xl font-extrabold">{t.name}</h2>
            <p className="font-bold text-ink/70">{t.pages} صفحات ملوّنة جاهزة للطباعة</p>
          </div>
        </button>
      ))}
      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-primary w-full" onClick={createOrder} disabled={busy || !selected}>
        {busy ? "لحظة…" : "التالي: الدفع"}
      </button>
    </div>
  );
}
