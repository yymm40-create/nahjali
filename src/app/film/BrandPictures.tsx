"use client";

import { useRef, useState } from "react";
import { uploadReference } from "@/components/jawad/studio/upload";
import { AD_BRAND_ROLES, type AdBrandRole } from "@config/film-ad";

/** A brand picture given on the new project page: the person's own image upload, and what it is. */
export interface BrandPick {
  fileId: string;
  role: AdBrandRole;
  name: string;
  url: string;
}

/**
 * «🏷️ صور براندك» (the ad path, config/film-ad.ts): the logo, the product, the colours — uploaded from the start as the
 * person's own pictures, looked at by «سجاد», then kept with the project (its «مراجع») for the screenwriter, the sheet
 * maker (put on the sheet map as they are) and the director.
 */
export default function BrandPictures({ value, onChange, disabled }: { value: BrandPick[]; onChange: (v: BrandPick[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const role = useRef<AdBrandRole>("logo");
  const [busy, setBusy] = useState<AdBrandRole | "">("");
  const [error, setError] = useState("");

  async function add(files: File[]) {
    const r = AD_BRAND_ROLES.find((x) => x.id === role.current)!;
    const room = r.max - value.filter((v) => v.role === r.id).length;
    if (!files.length) return;
    setError("");
    setBusy(r.id);
    let next = value;
    try {
      if (room <= 0) throw new Error(`الحد ${r.max} صور لـ«${r.ar}».`);
      for (const file of files.slice(0, room)) {
        if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw new Error("صورة JPG أو PNG أو WEBP.");
        const up = await uploadReference(file, "image");
        next = [...next, { fileId: up.id, role: r.id, name: file.name, url: up.url ?? "" }];
        onChange(next);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <b className="block text-base">🏷️ صور براندك <span className="text-sm text-muted">(اختياري)</span></b>
        <p className="text-xs leading-6 text-muted">الشعار والمنتج والألوان. سجاد يشوفها ويفهمها، والمنتج والشعار ينحطون على الخريطة «كما هم» ويروحون مرجع مع كل توليد.</p>
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => void add(Array.from(e.target.files ?? []))} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {AD_BRAND_ROLES.map((r) => {
          const mine = value.filter((v) => v.role === r.id);
          return (
            <div key={r.id} className="space-y-2 rounded-2xl border border-line p-2">
              <b className="block text-sm">{r.icon} {r.ar} <small className="text-xs text-muted">({mine.length}/{r.max})</small></b>
              {mine.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {mine.map((m) => (
                    <div key={m.fileId} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                      {m.url && <img src={m.url} alt={m.name} className="size-14 rounded-xl object-cover" />}
                      {!disabled && <button type="button" aria-label={`احذف ${m.name}`} className="absolute -end-1 -top-1 size-6 rounded-full bg-red-500 text-xs font-extrabold text-white" onClick={() => onChange(value.filter((v) => v.fileId !== m.fileId))}>×</button>}
                    </div>
                  ))}
                </div>
              )}
              {mine.length < r.max && (
                <button type="button" className="btn btn-ghost min-h-9 w-full px-2 text-xs" disabled={disabled || Boolean(busy)} onClick={() => { role.current = r.id; input.current?.click(); }}>
                  {busy === r.id ? "نرفع…" : "＋ ارفع"}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
    </section>
  );
}
