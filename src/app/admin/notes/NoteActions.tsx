"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/fetch";

/** Mark a note done (or new again), or delete it. */
export default function NoteActions({ id, status }: { id: string; status: "new" | "done" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api("/api/notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "تعذّر.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex gap-1.5">
      <button className={`btn min-h-9 px-3 text-xs ${status === "done" ? "btn-ghost" : "btn-primary"}`} disabled={busy} onClick={() => send({ status: status === "done" ? "new" : "done" })}>
        {status === "done" ? "↺ رجّعها جديدة" : "✓ تمت"}
      </button>
      <button className="btn min-h-9 bg-red-600 px-3 text-xs text-white" disabled={busy} onClick={() => confirm("نحذف الملاحظة؟") && send({ delete: true })}>
        حذف
      </button>
    </span>
  );
}
