"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminPost } from "./client";

/** Moves every unfinished job forward now (normally done by the studio's polling, callbacks and the daily sweep). */
export default function AdvanceJobsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        className="jw-btn"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg("");
          try {
            await adminPost("advance_jobs");
            setMsg("تم.");
            router.refresh();
          } catch (e) {
            setMsg((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? <span className="jw-spinner" /> : null} حدّث المهام المفتوحة الآن
      </button>
      {msg && <span className="text-xs text-jw-muted">{msg}</span>}
    </span>
  );
}
