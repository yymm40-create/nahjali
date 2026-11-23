"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { FILM_LIMITS } from "@config/film";
import { AD_BRAND_ROLES, adBrandRole, type AdBrandRole } from "@config/film-ad";

interface Ref {
  id: string;
  name: string;
  url: string;
  /** «📣 إعلان»: what this brand picture is */
  brand?: AdBrandRole | null;
}

/**
 * Optional reference images. They upload straight to private storage through a one-time signed URL. In an ad
 * («📣 إعلان») they are the brand's pictures: each is given as the logo, the product, the colours or another reference,
 * and the robots see them (the screenwriter, the sheet maker — the logo and products go on the map as they are — and
 * the director).
 */
export default function References({ projectId, initial, ad = false }: { projectId: string; initial: Ref[]; ad?: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState<AdBrandRole>("logo");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError("");
    try {
      for (const [i, file] of [...files].entries()) {
        setBusy(`نرفع ${i + 1} من ${files.length}…`);
        if (!FILM_LIMITS.uploadMimes.includes(file.type) || file.size > FILM_LIMITS.maxUploadBytes) {
          throw new Error(`«${file.name}»: المرجع لازم يكون صورة JPG أو PNG أو WEBP وحجمها أقل من ٢٠ ميجا.`);
        }
        const { path, token } = await postJson<{ path: string; token: string }>(`/api/film/projects/${projectId}/uploads`, {
          mime: file.type,
          bytes: file.size,
        });
        const put = await fetch(token, { method: "PUT", headers: { "content-type": file.type }, body: file });
        if (!put.ok) throw new Error("تعذّر رفع الصورة. جرّب مرة ثانية.");
        await postJson(`/api/film/projects/${projectId}/uploads/confirm`, { path, fileName: file.name, ...(ad ? { brand: role } : {}) });
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string) {
    setError("");
    try {
      await api(`/api/film/projects/${projectId}/assets/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="card space-y-3 p-5">
      <h2 className="display text-2xl">{ad ? "🏷️ صور براندك" : "مراجع"} <span className="text-base text-muted">(اختياري)</span></h2>
      <p className="text-sm font-bold text-muted">
        {ad
          ? "الشعار والمنتج والألوان. السيناريست وصانع الشيت والمخرج يشوفونها، والشعار والمنتج ينحطون على الخريطة «كما هم» ويروحون مرجع مع كل توليد."
          : "صور أماكن أو أغراض أو ستايل تحب يشوفها المساعدون."}{" "}
        الصور خاصة فيك وما يشوفها أحد غيرك.
      </p>
      {initial.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {initial.map((r) => (
            <li key={r.id} className="relative overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={r.url} alt={r.name} className="aspect-square w-full object-cover" />
              {r.brand && <span className="absolute bottom-1 start-1 rounded-full bg-page/90 px-2 text-xs font-black">{adBrandRole(r.brand)?.icon} {adBrandRole(r.brand)?.ar}</span>}
              <button
                onClick={() => remove(r.id)}
                className="absolute end-1 top-1 grid size-8 place-items-center rounded-full bg-page/90 text-sm"
                aria-label={`احذف ${r.name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept={FILM_LIMITS.uploadMimes.join(",")} multiple hidden onChange={(e) => upload(e.target.files)} />
      {ad && (
        <div className="flex flex-wrap gap-2 text-sm font-bold" role="group" aria-label="وش هالصورة؟">
          <span className="self-center text-xs text-muted">وش الصورة اللي بترفعها؟</span>
          {AD_BRAND_ROLES.map((r) => (
            <button key={r.id} type="button" aria-pressed={role === r.id} className={`chip ${role === r.id ? "bg-gold text-on-gold" : ""}`} onClick={() => setRole(r.id)}>{r.icon} {r.ar}</button>
          ))}
        </div>
      )}
      <button className="btn btn-ghost w-full" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
        {busy || (ad ? `＋ ارفع ${adBrandRole(role)?.ar}` : "＋ أضف صور مرجعية")}
      </button>
      {error && <p className="error-box">{error}</p>}
    </section>
  );
}
