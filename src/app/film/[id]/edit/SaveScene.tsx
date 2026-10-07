"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

/** «احفظه في المشهد الناجح»: the film's exported montage kept by the film itself. */
export default function SaveScene({ filmId, saved, disabled }: { filmId: string; saved: boolean; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/film/projects/${filmId}/scene`, {});
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" className={`btn w-full ${saved ? "btn-ghost" : "btn-primary"}`} disabled={disabled || busy} onClick={save}>
        {busy ? "نحفظ…" : saved ? "🔁 حدّثه من آخر تصدير" : "🏆 احفظ المونتاج في «المشهد الناجح»"}
      </button>
      {error && <p className="error-box text-sm">{error}</p>}
    </div>
  );
}
