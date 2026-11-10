"use client";

import { useState } from "react";

/** The connector's address with a copy button. */
export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code dir="ltr" className="min-w-0 flex-1 break-all rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-bold">
        {url}
      </code>
      <button
        type="button"
        className="btn btn-primary min-h-11 px-5 text-base"
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 2000);
          });
        }}
      >
        {done ? "✅ انتسخ" : "انسخ الرابط"}
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
        className="btn btn-ghost min-h-11 px-5 text-base"
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
