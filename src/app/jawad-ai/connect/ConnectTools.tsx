"use client";

import { useState } from "react";

/** The connector's address with a copy button. */
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="cn-link">
      <code dir="ltr">{url}</code>
      <button
        type="button"
        className="cn-btn"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          });
        }}
      >
        {done ? <span className="cn-ok">✅ انتسخ</span> : "انسخ الرابط"}
      </button>
    </div>
  );
}

/** «افصل الربط»: every Claude / ChatGPT link of this account stops working. */
export function Disconnect() {
  const [state, setState] = useState<"" | "busy" | "done" | string>("");
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="cn-btn-soft"
        disabled={state === "busy"}
        onClick={async () => {
          if (!window.confirm("تفصل كل ربط كلاود وشات جي بي تي بحسابك؟ يوقف على طول، وتقدر تربط من جديد بعدين.")) return;
          setState("busy");
          const r = await fetch("/api/mcp/revoke", { method: "POST" }).catch(() => null);
          const j = (await r?.json().catch(() => null)) as { error?: string } | null;
          setState(r?.ok ? "done" : j?.error ?? "ما قدرنا نفصل الربط الحين.");
        }}
      >
        {state === "busy" ? "…" : "افصل الربط"}
      </button>
      {state === "done" && <p className="text-sm font-bold text-emerald-600">✅ انفصل. أي ربط قديم ما عاد يشتغل.</p>}
      {state && state !== "busy" && state !== "done" && <p className="text-sm font-bold text-red-500">{state}</p>}
    </div>
  );
}
