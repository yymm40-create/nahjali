"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/fetch";

interface Props {
  code: string;
  enabled: boolean;
  /** who came in by the code (signed in, by email), and whether it's by the code that's on now */
  users: { email: string; at: string; live: boolean }[];
}

/** «الكود السري»: the owner sets it, switches it off or on, and sees who came in by it. */
export default function SecretCode(p: Props) {
  const router = useRouter();
  const [code, setCode] = useState(p.code);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setMsg(null);
    try {
      await postJson("/api/admin/access", body);
      setMsg({ ok: true, text: done });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "تعذّر الحفظ." });
    } finally {
      setBusy(false);
    }
  }
  const changed = code.trim() !== p.code;
  const fmt = (iso: string) => new Date(iso).toLocaleString("ar", { timeZone: "Asia/Riyadh", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const live = p.users.filter((u) => u.live);

  return (
    <section className="card space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold">🗝️ الكود السري</h2>
        <button
          type="button"
          className={`btn min-h-10 px-4 text-sm ${p.enabled ? "bg-teal text-white" : "btn-ghost"}`}
          disabled={busy || !p.code}
          aria-pressed={p.enabled}
          onClick={() => send({ action: "code", enabled: !p.enabled }, p.enabled ? "انطفى الكود: انقفل على كل اللي دخلوا فيه" : "اشتغل الكود")}
        >
          {p.enabled ? "✓ شغّال · اضغط تطفيه" : "✗ طافي · اضغط تشغّله"}
        </button>
      </div>
      <p className="text-sm font-bold text-muted">
        أول ما يفتح أحد الموقع ينسأل «عندك الكود السري؟». يسجّل دخوله، يكتبه، وينفتح له كل شي مجانًا بلا حدود (ما عدا «🎮 صانع الألعاب» وأي قسم يفتح بالاسم بس). لو طفيته أو غيّرته، ينقفل على كل اللي دخلوا بالكود القديم.
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (changed) send({ action: "code", code }, p.code ? "تغيّر الكود: اللي دخلوا بالقديم انقفل عليهم" : "انحفظ الكود");
        }}
      >
        <input className="field min-w-0 flex-1" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="الكود (٤ أحرف أو أكثر)" maxLength={64} aria-label="الكود السري" />
        <button className="btn btn-primary min-h-12 px-5" disabled={busy || !changed || code.trim().length < 4}>
          {p.code ? "غيّره" : "احفظه"}
        </button>
      </form>
      {msg && <p className={`text-sm font-bold ${msg.ok ? "text-teal" : "text-red-600"}`}>{msg.text}</p>}
      <div className="space-y-2">
        <h3 className="font-extrabold">اللي دخلوا بالكود ({live.length})</h3>
        {p.users.length ? (
          <ul className="space-y-1.5">
            {p.users.map((u) => (
              <li key={u.email} className={`flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-2.5 ${u.live ? "" : "opacity-60"}`}>
                <b className="min-w-0 flex-1 truncate" dir="ltr">{u.email}</b>
                <span className="text-xs font-bold text-muted">{fmt(u.at)} · {u.live && p.enabled ? "مفتوح له" : "انقفل (كود قديم أو طافي)"}</span>
                <button type="button" className="btn min-h-9 bg-red-600 px-3 text-xs text-white" disabled={busy} onClick={() => confirm(`نقفل على ${u.email}؟`) && send({ action: "uncode", email: u.email }, "انقفل عليه")}>
                  ✗ اقفل عليه
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-bold text-muted">ما دخل أحد بالكود للحين.</p>
        )}
      </div>
    </section>
  );
}
