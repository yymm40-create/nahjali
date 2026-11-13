"use client";

// On a film project's page: the owner sees the admin he let in (and can stop it); the admin sees whose project this is.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";

export type AccessBar = { role: "owner"; grants: { id: string }[] } | { role: "admin"; id: string; ownerEmail: string };

export default function ProjectAccessBar({ bar }: { bar: AccessBar }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function stop(ids: string[], ask: string) {
    if (!window.confirm(ask)) return;
    setBusy(true);
    setError("");
    try {
      for (const id of ids) await postJson("/api/film/access", { action: "revoke", id });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-3 text-sm font-extrabold text-amber-950">
      {bar.role === "owner" ? (
        <>
          <span className="flex-1">🔑 الأدمن مسموح له يدخل هذا المشروع ويعدّل فيه.</span>
          <button type="button" className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs" disabled={busy} onClick={() => void stop(bar.grants.map((g) => g.id), "توقف سماح الأدمن؟ بعدها ما يقدر يفتح المشروع لين يطلب مرة ثانية وتوافق.")}>
            أوقف السماح
          </button>
        </>
      ) : (
        <>
          <span className="flex-1">🔑 تشتغل على مشروع <span dir="ltr">{bar.ownerEmail || "صاحبه"}</span>: كل تعديل يصير عنده، والتكلفة عليك.</span>
          <button type="button" className="rounded-lg border border-amber-600 px-3 py-1.5 text-xs" disabled={busy} onClick={() => void stop([bar.id], "تطلع من المشروع؟ بعدها ما يطلع عندك لين تطلب مرة ثانية ويوافق.")}>
            اطلع منه
          </button>
        </>
      )}
      {error && <span className="w-full text-xs text-red-600">{error}</span>}
    </div>
  );
}
