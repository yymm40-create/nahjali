"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cleanUsername, USERNAME_RE } from "@/lib/username-rules";

/** Choose the username (prefilled from the account's name); can't continue until it is free. */
export default function UsernameStep({ suggestion, next }: { suggestion: string; next: string }) {
  const router = useRouter();
  const [value, setValue] = useState(suggestion);
  const [check, setCheck] = useState<{ name: string; ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = cleanUsername(value);
  const valid = USERNAME_RE.test(name);

  useEffect(() => {
    if (!valid) return;
    let live = true;
    const id = setTimeout(() => {
      fetch(`/api/username?check=${encodeURIComponent(name)}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((r: { available?: boolean; message?: string }) => live && setCheck({ name, ok: Boolean(r.available), message: r.available ? "الاسم متاح ✅" : (r.message ?? "") }))
        .catch(() => {});
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [name, valid]);

  const status = !name ? null : !valid ? { ok: false, message: "من ٣ إلى ٢٠ حرف: حروف عربية أو إنجليزية وأرقام و _ ، ويبدأ بحرف." } : check?.name === name ? check : { ok: false, message: "لحظة، نتأكد من الاسم…" };

  return (
    <form
      className="card mx-auto mt-6 max-w-md space-y-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const res = await fetch("/api/username", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: name }) }).catch(() => null);
        const body = await res?.json().catch(() => ({}));
        if (res?.ok) {
          router.replace(next);
          router.refresh();
        } else {
          setError(body?.error ?? "تعذّر الحفظ. جرّب مرة ثانية.");
          setBusy(false);
        }
      }}
    >
      <h1 className="display text-4xl">اختر اسم المستخدم</h1>
      <p className="font-bold text-muted">لكل حساب في نهج علي اسم مميز ما يتكرر، يعرفك فيه غيرك ويضيفك به إخوتك. المسافة تصير _ .</p>
      <label className="block space-y-1">
        <span className="text-sm font-bold">اسم المستخدم</span>
        <input className="field" dir="auto" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={24} autoFocus value={value} onChange={(e) => (setValue(e.target.value), setError(""))} placeholder="مثال: عبدالله_محمد" />
      </label>
      {name && name !== value.trim() && valid && <p className="text-sm font-bold text-muted" dir="auto">سيُحفظ هكذا: {name}</p>}
      {status && <p className={`text-sm font-bold ${status.ok ? "" : "text-muted"}`} role="status">{status.message}</p>}
      {error && <p className="error-box" role="alert">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy || !status?.ok}>{busy ? "لحظة…" : "احفظ وتابع"}</button>
    </form>
  );
}
