"use client";

import { useState } from "react";

interface Progress {
  copied: number;
  skipped: number;
  failed: string[];
  done: boolean;
  finished: boolean;
}

/** Runs the copy in rounds of a few minutes until every old file is in R2. */
export default function CopyFiles() {
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState({ copied: 0, skipped: 0 });
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const sum = { copied: 0, skipped: 0 };
    try {
      for (;;) {
        const res = await fetch("/api/admin/storage", { method: "POST" });
        const p = (await res.json().catch(() => ({}))) as Partial<Progress> & { error?: string };
        if (!res.ok) throw new Error(p.error ?? `خطأ ${res.status}`);
        sum.copied += p.copied ?? 0;
        sum.skipped = Math.max(sum.skipped, p.skipped ?? 0);
        setTotal({ ...sum });
        if (p.done) {
          if (p.finished) setResult({ ok: true, text: "✅ خلص النقل. كل الملفات صارت في R2." });
          else setResult({ ok: false, text: `ما انتقلت ${p.failed?.length ?? 0} ملفات. اضغط الزر مرة ثانية.` });
          break;
        }
      }
    } catch (e) {
      setResult({ ok: false, text: `توقف النقل: ${(e as Error).message}. اضغط الزر مرة ثانية ويكمل من مكانه.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4 p-4">
      <p>الملفات الجديدة تنحفظ في R2. هذا الزر ينسخ الملفات القديمة من سوبابيس، وتقدر تضغطه أكثر من مرة بدون مشكلة.</p>
      <button type="button" className="btn btn-primary w-full" disabled={busy} onClick={run}>
        {busy ? "ننقل الملفات… خل الصفحة مفتوحة" : "انقل الملفات القديمة إلى R2"}
      </button>
      {(busy || total.copied > 0) && <p className="text-sm text-muted" role="status">انتقل {total.copied} ملف</p>}
      {result && <p className={`font-bold ${result.ok ? "" : "text-red-700"}`}>{result.text}</p>}
    </div>
  );
}
