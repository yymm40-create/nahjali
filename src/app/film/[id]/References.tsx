"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import { createClient } from "@/lib/supabase/client";
import { FILM_LIMITS } from "@config/film";

interface Ref {
  id: string;
  name: string;
  url: string;
}

/** Optional reference images. They upload straight to private storage through a one-time signed URL. */
export default function References({ projectId, initial }: { projectId: string; initial: Ref[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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
        const { error: upErr } = await createClient().storage.from("film").uploadToSignedUrl(path, token, file, { contentType: file.type });
        if (upErr) throw new Error("تعذّر رفع الصورة. جرّب مرة ثانية.");
        await postJson(`/api/film/projects/${projectId}/uploads/confirm`, { path, fileName: file.name });
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
      <h2 className="display text-2xl">مراجع <span className="text-base text-muted">(اختياري)</span></h2>
      <p className="text-sm font-bold text-muted">صور أماكن أو أغراض أو ستايل تحب يشوفها المساعدون. الصور خاصة فيك وما يشوفها أحد غيرك.</p>
      {initial.length > 0 && (
        <ul className="grid grid-cols-3 gap-2">
          {initial.map((r) => (
            <li key={r.id} className="relative overflow-hidden rounded-2xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
              <img src={r.url} alt={r.name} className="aspect-square w-full object-cover" />
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
      <button className="btn btn-ghost w-full" onClick={() => input.current?.click()} disabled={Boolean(busy)}>
        {busy || "＋ أضف صور مرجعية"}
      </button>
      {error && <p className="error-box">{error}</p>}
    </section>
  );
}
