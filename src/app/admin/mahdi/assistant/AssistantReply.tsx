"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { t } from "@/lib/mahdi/i18n";

const A = t.admin.assistant;

/** The owner's answer to one person (it reaches them as a notification). */
export default function AssistantReply({ userId, waiting }: { userId: string; waiting: number }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function send(action: "assistant.reply" | "assistant.read") {
    if (action === "assistant.reply" && !text.trim()) return setError(A.empty);
    setBusy(true);
    setError("");
    setMsg("");
    try {
      await postJson("/api/admin/mahdi", { action, userId, text });
      if (action === "assistant.reply") {
        setText("");
        setMsg(A.sent);
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        send("assistant.reply");
      }}
    >
      <label className="block space-y-1">
        <span className="font-bold">{A.reply}</span>
        <textarea className="field" rows={4} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} dir="auto" />
      </label>
      {error && <p role="alert" className="font-bold text-red-500">{error}</p>}
      {msg && <p role="status" className="font-bold">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t.admin.common.loading : A.send}</button>
        {waiting > 0 && (
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => send("assistant.read")}>{A.markRead}</button>
        )}
      </div>
    </form>
  );
}
