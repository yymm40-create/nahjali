"use client";

// The admin's side of «اسمح للأدمن بالدخول على مشروعك»: ask the owner, see his answer, open the project once allowed.

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

type Status = "pending" | "approved" | "declined" | "revoked";

export default function AdminAccessButton({ projectId, request, own = false }: { projectId: string; request?: { id: string; status: Status } | null; own?: boolean }) {
  const [r, setR] = useState(request ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (own) return <span className="text-xs font-bold text-muted">مشروعك</span>;

  async function ask() {
    setBusy(true);
    setError("");
    try {
      const { status, id } = await postJson<{ status: Status; id: string }>("/api/film/access", { action: "request", projectId });
      setR({ id, status });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    if (!r?.id || !window.confirm("تطلع من المشروع؟ بعدها ما يطلع عندك لين تطلب مرة ثانية ويوافق.")) return;
    setBusy(true);
    try {
      await postJson("/api/film/access", { action: "revoke", id: r.id });
      setR({ ...r, status: "revoked" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
      {r?.status === "approved" ? (
        <>
          <Link href={`/jawad-ai/film/${projectId}`} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-white">✅ مسموح · افتحه</Link>
          {r.id && <button type="button" className="rounded-lg border border-line px-2 py-1.5" disabled={busy} onClick={() => void leave()}>اطلع منه</button>}
        </>
      ) : r?.status === "pending" ? (
        <span className="rounded-lg bg-amber-100 px-2.5 py-1.5 text-amber-900">⏳ بانتظار موافقته</span>
      ) : (
        <button type="button" className="rounded-lg border-2 border-amber-500 px-2.5 py-1.5" disabled={busy} onClick={() => void ask()}>
          {busy ? "نرسل…" : r?.status === "declined" ? "رفض · 🔑 اطلب مرة ثانية" : r?.status === "revoked" ? "انوقف · 🔑 اطلب مرة ثانية" : "🔑 اطلب الدخول"}
        </button>
      )}
      {error && <span className="text-red-600">{error}</span>}
    </span>
  );
}
