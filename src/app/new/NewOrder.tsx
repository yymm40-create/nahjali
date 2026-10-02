"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import Steps from "@/components/Steps";

interface Option {
  key: string;
  label: string;
  description: string;
}
interface Tier extends Option {
  price_halalas: number;
}

interface Props {
  templateId: string;
  tiers: Tier[];
  styles: Option[];
  defaultQuality: string;
  defaultStyle: string;
  freeTrial: boolean;
  trialsLeft: number | null;
  pendingOrder: { id: string; amount_halalas: number } | null;
  devPayment: boolean;
}

const sar = (halalas: number) => `${halalas / 100} ريال`;
const NAME_RE = /^[\p{L}\p{M} ]{1,30}$/u;

export default function NewOrder(props: Props) {
  const { templateId, tiers, styles, freeTrial, trialsLeft, pendingOrder, devPayment } = props;
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [childName, setChildName] = useState("");
  const [gender, setGender] = useState<"boy" | "girl" | "">("");
  const [parentMessage, setParentMessage] = useState("");
  const [style, setStyle] = useState(props.defaultStyle);
  const [quality, setQuality] = useState(props.defaultQuality);
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
      const { next } = await postJson<{ next: string }>("/api/orders", {
        templateId,
        quality,
        style,
        gender,
        childName: childName.trim(),
        parentMessage: parentMessage.trim(),
      });
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
        <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4 text-xl font-extrabold">
          <span>المبلغ</span>
          <span>{sar(pendingOrder.amount_halalas)}</span>
        </div>
        {devPayment ? (
          <button className="btn btn-primary w-full" onClick={pay} disabled={busy}>
            {busy ? "لحظة…" : "دفع تجريبي (وضع التطوير)"}
          </button>
        ) : (
          <p className="error-box">الدفع غير متاح حاليًا. جرّب لاحقًا.</p>
        )}
        {error && <p className="error-box">{error}</p>}
      </div>
    );
  }

  const noTrialsLeft = freeTrial && trialsLeft === 0;
  const nameOk = NAME_RE.test(childName.trim());
  const he = gender === "girl" ? "ها" : "ه";

  return (
    <div className="space-y-6">
      {freeTrial && (
        <p className="chip w-full justify-center py-2 text-base">
          🎁 {noTrialsLeft ? "استخدمت كل تجاربك المجانية" : `مجاني بالكامل · باقي لك ${trialsLeft} ${trialsLeft === 1 ? "تجربة" : "تجارب"}`}
        </p>
      )}
      <Steps labels={["الطفل", "الستايل", "الجودة"]} current={step} />

      {step === 0 && (
        <section className="space-y-5">
          <h1 className="display text-3xl">مين بطل الكتيب؟</h1>
          <label className="block space-y-2">
            <span className="font-extrabold">اسم الطفل</span>
            <input
              className="field"
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="مثلًا: علي، زهراء"
              maxLength={30}
              autoComplete="off"
            />
            <span className="block text-sm font-bold text-muted">يطلع على الغلاف وداخل الصفحات</span>
          </label>
          <div className="space-y-2">
            <span className="font-extrabold">ولد أو بنت؟</span>
            <div role="radiogroup" className="grid grid-cols-2 gap-3">
              {(
                [
                  ["boy", "👦", "ولد"],
                  ["girl", "👧", "بنت"],
                ] as const
              ).map(([key, icon, label]) => (
                <button
                  key={key}
                  role="radio"
                  aria-checked={gender === key}
                  onClick={() => setGender(key)}
                  className="option flex flex-col items-center gap-1 py-5"
                >
                  <span className="text-5xl">{icon}</span>
                  <span className="text-xl font-extrabold">{label}</span>
                </button>
              ))}
            </div>
            {gender === "girl" && (
              <p className="text-sm font-bold text-muted">تطلع البنت بالعباءة الزينبية الكاملة في كل الصفحات، بدون مكياج.</p>
            )}
          </div>
          <label className="block space-y-2">
            <span className="font-extrabold">
              رسالة منكم لطفلكم <span className="text-sm text-muted">(اختياري)</span>
            </span>
            <textarea
              className="field min-h-24 resize-none"
              value={parentMessage}
              onChange={(e) => setParentMessage(e.target.value.slice(0, 140))}
              placeholder={`مثلًا: نحبك يا ${childName.trim() || "بطلنا"}، وفخورين فيك بكل خطوة 💛`}
              maxLength={140}
            />
            <span className="block text-sm font-bold text-muted">
              تنطبع في صفحة &quot;هذا أنا&quot;. إذا تركتوها فاضية، تبقى أسطر تكتبون فيها بخط يدكم. ({parentMessage.length}/١٤٠)
            </span>
          </label>
          <button className="btn btn-primary w-full" disabled={!nameOk || !gender} onClick={() => setStep(1)}>
            التالي
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <h1 className="display text-3xl">بأي ستايل تبي {childName.trim() || `شخصيت${he}`}؟</h1>
          <div role="radiogroup" className="grid grid-cols-2 gap-3">
            {styles.map((s) => (
              <button key={s.key} role="radio" aria-checked={style === s.key} onClick={() => setStyle(s.key)} className="option overflow-hidden p-0">
                <Image src={`/styles/${s.key}.jpg`} alt="" width={400} height={400} className="aspect-square w-full object-cover" />
                <span className="block p-3">
                  <span className="block font-extrabold">{s.label}</span>
                  <span className="block text-xs font-bold text-muted">{s.description}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button className="btn btn-ghost" onClick={() => setStep(0)}>رجوع</button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>التالي</button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-5">
          <h1 className="display text-3xl">اختر الجودة</h1>
          <div role="radiogroup" className="space-y-3">
            {tiers.map((t) => (
              <button
                key={t.key}
                role="radio"
                aria-checked={quality === t.key}
                onClick={() => setQuality(t.key)}
                className="option flex w-full items-center justify-between gap-3 p-4"
              >
                <span>
                  <span className="block text-lg font-extrabold">{t.label}</span>
                  <span className="block text-sm font-bold text-muted">{t.description}</span>
                </span>
                <span className="shrink-0 text-end">
                  {freeTrial ? (
                    <>
                      <span className="block text-sm font-bold text-muted line-through">{sar(t.price_halalas)}</span>
                      <span className="display block text-xl text-teal">مجانًا</span>
                    </>
                  ) : (
                    <span className="display block text-xl">{sar(t.price_halalas)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {error && <p className="error-box">{error}</p>}
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button className="btn btn-ghost" onClick={() => setStep(1)} disabled={busy}>رجوع</button>
            <button className="btn btn-primary" onClick={createOrder} disabled={busy || noTrialsLeft || !templateId}>
              {busy ? "لحظة…" : freeTrial ? "جرّب مجانًا ✨" : "التالي: الدفع"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
