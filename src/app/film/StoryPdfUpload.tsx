"use client";

import { useState } from "react";
import { probeFile, putWithProgress } from "@/components/jawad/studio/upload";
import type { StoryPdf } from "@/lib/film/story-link";

/** The biggest PDF سجاد reads whole (lib/claude-images DOC_BYTES: it travels inside the request). */
const PDF_MAX_BYTES = 12_000_000;

/**
 * «📄 ملف PDF» (the lesson path): the lesson's PDF goes up as the person's own upload (with progress); «سجاد» reads the
 * file itself — its text, pictures and tables (lib/film/intake) — and says what he understood before anything is made.
 */
export default function StoryPdfUpload({ pdf, onPdf }: { pdf: StoryPdf | null; onPdf: (v: StoryPdf | null) => void }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function choose(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const probe = await probeFile(file);
      if (probe.kind !== "doc") throw new Error("هذا مو ملف PDF. اختر ملف الدرس بصيغة PDF.");
      if (file.size > PDF_MAX_BYTES) throw new Error(`الملف ${Math.round(file.size / 1_000_000)} ميجا، والحد ١٢ ميجا عشان سجاد يقراه كله. صغّره أو ارفع صفحات الدرس المطلوبة بس.`);
      setBusy("⬆️ أرفع الملف… 0٪");
      const post = async <T,>(url: string, data: unknown) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as T & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "تعذّر رفع الملف.");
        return body;
      };
      const signed = await post<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "doc", mime: probe.mime, bytes: file.size, fileName: file.name });
      await putWithProgress(signed.signedUrl, file, probe.mime, (p) => setBusy(`⬆️ أرفع الملف… ${Math.round(p * 100)}٪`));
      setBusy("🔎 أفحص الملف…");
      const conf = await post<{ upload: { id: string; status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
      if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر فحص الملف.");
      onPdf({ name: file.name, fileId: conf.upload.id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-2">
      {pdf ? (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-[var(--film-blue)] bg-[var(--film-blue)]/10 p-3">
          <span className="text-2xl" aria-hidden>📄</span>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-sm" dir="auto">{pdf.name}</b>
            <small className="text-xs font-bold text-muted">✓ انرفع، وسجاد بيقراه كله</small>
          </span>
          <button type="button" className="btn text-xs" onClick={() => onPdf(null)} disabled={!!busy}>غيّره</button>
        </div>
      ) : (
        <label className={`block cursor-pointer rounded-2xl border-2 border-dashed border-line p-5 text-center ${busy ? "opacity-70" : ""}`}>
          <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={!!busy} onChange={(e) => void choose(e.target.files?.[0])} />
          <span className="block text-3xl" aria-hidden>📄</span>
          <b className="block text-sm">{busy || "اختر ملف الدرس (PDF)"}</b>
          {!busy && <small className="text-xs font-bold text-muted">PDF، لين ١٢ ميجا</small>}
        </label>
      )}
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <p className="text-xs leading-6 text-muted">سجاد يقرا الدرس كله (النص والصور والجداول)، ويقول لك وش فهم منه قبل ما يسوي الدرس.</p>
    </div>
  );
}
