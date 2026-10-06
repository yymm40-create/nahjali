"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

/** «ركّب النسخة الأولى» (or, once made, «افتح المونتاج»): opens the film's edit in «حيدر كات». */
export default function OpenEdit({ filmId, exists, disabled }: { filmId: string; exists: boolean; disabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await postJson<{ id: string }>(`/api/jawad/editor/film/${filmId}`);
      router.push(`/jawad-ai/editor/${r.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر.");
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" className="btn btn-primary w-full" disabled={disabled || busy} onClick={open}>
        {busy ? "لحظة…" : exists ? "✂️ افتح المونتاج" : "✂️ ركّب النسخة الأولى"}
      </button>
      {error && <p className="error-box text-sm">{error}</p>}
    </div>
  );
}
