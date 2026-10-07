"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const ASKED = "secret-asked";
const PENDING = "secret-pending";
const SKIP = ["/mahdi", "/login", "/auth", "/admin", "/jawad-ai/login", "/privacy", "/terms", "/editor-test"];
const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch {}
};

/** Opens the question from anywhere (e.g. a «عندي كود سري» link). */
export const openSecretGate = () => window.dispatchEvent(new Event("secret:open"));

/**
 * «الكود السري»: the first time someone opens the site they're asked whether they have it. They sign in first (so the
 * owner knows who used it), enter it, and everything opens for them. Asked once per browser; «لأجل المهدي» is never
 * interrupted.
 */
export default function SecretGate() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const show = () =>
      fetch("/api/access/code", { cache: "no-store" })
        .then((r) => r.json())
        .then((s: { signedIn: boolean; open: boolean }) => {
          if (s.open) {
            write(ASKED, "1");
            write(PENDING, null);
            return;
          }
          setSignedIn(s.signedIn);
          setOpen(true);
        })
        .catch(() => {});
    const onOpen = () => show();
    window.addEventListener("secret:open", onOpen);
    const skip = SKIP.some((p) => path === p || path.startsWith(`${p}/`));
    const fromLink = new URLSearchParams(window.location.search).has("secret");
    const t = setTimeout(() => {
      if (fromLink || (!skip && (read(PENDING) || !read(ASKED)))) show();
    }, 900);
    return () => {
      clearTimeout(t);
      window.removeEventListener("secret:open", onOpen);
    };
  }, [path]);

  if (!open) return null;
  const close = () => {
    write(ASKED, "1");
    write(PENDING, null);
    setOpen(false);
  };
  async function send() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/access/code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "تعذّر التحقق.");
      write(ASKED, "1");
      write(PENDING, null);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر التحقق.");
    } finally {
      setBusy(false);
    }
  }
  const here = typeof window === "undefined" ? "/" : window.location.pathname;
  const login = here.startsWith("/jawad-ai") ? `/jawad-ai/login?next=${encodeURIComponent(here)}` : `/login?next=${encodeURIComponent(here)}`;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="secret-title" dir="rtl">
      <div className="w-full max-w-sm space-y-4 rounded-3xl bg-white p-6 text-center text-slate-900 shadow-2xl">
        <p className="text-5xl" aria-hidden>🗝️</p>
        <h2 id="secret-title" className="text-2xl font-extrabold">عندك الكود السري؟</h2>
        {signedIn ? (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) send();
            }}
          >
            <p className="text-sm font-bold text-slate-500">اكتبه وينفتح لك كل شي في الموقع.</p>
            <input autoFocus className="w-full rounded-2xl border-2 border-slate-200 px-4 py-3 text-center text-lg font-bold outline-none focus:border-sky-500" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} maxLength={64} aria-label="الكود السري" />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <button className="w-full rounded-2xl bg-sky-600 py-3 font-extrabold text-white disabled:opacity-50" disabled={busy || !code.trim()}>
              {busy ? "لحظة…" : "افتح"}
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-500">سجّل دخولك أول، وبعدها تكتب الكود وينفتح لك كل شي.</p>
            <a href={login} onClick={() => write(PENDING, "1")} className="block w-full rounded-2xl bg-sky-600 py-3 font-extrabold text-white">
              نعم، سجّل دخولي
            </a>
          </div>
        )}
        <button type="button" onClick={close} className="w-full rounded-2xl py-2 font-bold text-slate-500 hover:bg-slate-100">
          لا، ما عندي
        </button>
      </div>
    </div>
  );
}
