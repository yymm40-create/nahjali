"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fetch";

/** Shrinks the photo in the browser so uploads stay small (Vercel limits request size). */
async function shrinkImage(file: File, maxSide = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode failed"))), "image/jpeg", 0.9),
  );
}

export default function UploadForm({ orderId, attemptsLeft }: { orderId: string; attemptsLeft: number }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pick(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("اختر ملف صورة.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      let blob: Blob;
      try {
        blob = await shrinkImage(file);
      } catch {
        throw new Error("ما قدرنا نقرأ الصورة. جرّب صورة JPG أو PNG.");
      }
      const form = new FormData();
      form.append("photo", blob, "photo.jpg");
      await api(`/api/orders/${orderId}/upload`, { method: "POST", body: form });
      router.push(`/order/${orderId}/character?generate=1`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="display text-4xl">ارفع صورتك</h1>

      <div className="card space-y-2 bg-sun p-4 font-bold">
        <p>نصايح لأفضل نتيجة:</p>
        <ul className="list-inside list-disc text-ink/80">
          <li>شخص واحد فقط في الصورة</li>
          <li>الوجه واضح وإضاءة جيدة</li>
          <li>يفضّل يبان الجسم كامل أو نصّه</li>
        </ul>
      </div>

      <label className="card flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden p-4 text-center">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
          <img src={preview} alt="صورتك" className="h-full w-full rounded-2xl object-contain" />
        ) : (
          <>
            <span className="display grid size-20 place-items-center rounded-full border-[3px] border-ink bg-lime text-5xl">+</span>
            <span className="text-xl font-extrabold">اضغط لاختيار صورة</span>
            <span className="text-sm font-bold text-ink/60">JPG أو PNG أو WEBP</span>
          </>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </label>

      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border-[3px] border-ink bg-white p-3 text-sm font-bold">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-grape"
        />
        <span>
          أقرّ إن الصورة لي أو عندي إذن صاحبها، وإذا كانت لطفل فأنا ولي أمره. صورتك الأصلية تنحذف فور اعتماد الشخصية.{" "}
          <Link href="/privacy" target="_blank" className="underline">
            سياسة الخصوصية
          </Link>
        </span>
      </label>

      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-primary w-full" onClick={submit} disabled={!file || !consent || busy}>
        {busy ? "نرفع الصورة…" : "حوّلني لشخصية كرتونية"}
      </button>
      <p className="text-center text-sm font-bold text-ink/60">المحاولات المتبقية: {attemptsLeft}</p>
    </div>
  );
}
