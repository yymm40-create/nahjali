"use client";

import { useRef, useState } from "react";
import Icon from "@/components/jawad/Icon";
import { putWithProgress } from "@/components/jawad/studio/upload";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, JobStatus, PaidButton, useAsync } from "./ui";

const KIND = { text: "نص مكتوب", image: "صورة", pdf: "PDF" } as const;

export default function SourcesStep({ p }: { p: ProjectHook }) {
  const { sources, jobs, project, segments } = p.state;
  const [text, setText] = useState("");
  const [uploads, setUploads] = useState<{ name: string; progress: number; error?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const { busy, error, run } = useAsync();
  const job = jobs.find((j) => j.kind === "extract");
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = [...files];
    setUploads(list.map((f) => ({ name: f.name, progress: 0 })));
    // one after the other, in the order chosen, so the material keeps its order
    for (const [i, f] of list.entries()) {
      try {
        const mime = f.type || (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
        const r = (await p.act({ action: "source_file", name: f.name, mime, bytes: f.size })) as { sourceId: string; signedUrl: string };
        await putWithProgress(r.signedUrl, f, mime, (x) => setUploads((u) => u.map((y, k) => (k === i ? { ...y, progress: x } : y))));
        await p.act({ action: "source_confirm", sourceId: r.sourceId });
        setUploads((u) => u.map((y, k) => (k === i ? { ...y, progress: 1 } : y)));
      } catch (e) {
        setUploads((u) => u.map((y, k) => (k === i ? { ...y, error: e instanceof Error ? e.message : String(e) } : y)));
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const move = (id: string, d: -1 | 1) => {
    const ids = sources.map((s) => s.id);
    const i = ids.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return run(() => p.act({ action: "source_order", ids }));
  };

  const pending = sources.filter((s) => s.status === "ready" && (s.kind === "pdf" ? s.pagesDone < s.pages : s.pagesDone < 1));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files);
          }}
          className={`jw-panel flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed p-8 text-center transition-all ${drag ? "scale-[1.01] !border-pink-400 bg-pink-50" : "!border-violet-300 hover:!border-violet-500"}`}
        >
          <span className="st-tile size-16 text-3xl" style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)" }} aria-hidden>
            📤
          </span>
          <b className="text-lg">اسحب ملفاتك هنا أو اضغط للاختيار</b>
          <span className="text-sm text-jw-muted">صور أو ملفات PDF — عدة ملفات مرة وحدة، بالترتيب الذي تختاره</span>
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>
        {uploads.length > 0 && (
          <ul className="jw-panel space-y-2 p-4 text-sm">
            {uploads.map((u, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{u.name}</span>
                  {u.error ? <span className="text-jw-danger">{u.error}</span> : u.progress >= 1 ? <Icon name="check" size={16} className="text-jw-ok" /> : null}
                </div>
                {!u.error && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-jw-surface-3">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(u.progress * 100)}%`, background: "var(--st-grad)" }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <details className="jw-panel p-4">
          <summary className="cursor-pointer font-semibold">✍️ أو الصق نصًا مكتوبًا</summary>
          <div className="mt-3 space-y-3">
            <textarea className="jw-textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="الصق النص هنا. يُحفظ كما كتبته تمامًا." aria-label="النص" />
            <button type="button" className="jw-btn" disabled={busy || !text.trim()} onClick={() => run(async () => { await p.act({ action: "source_text", body: text }); setText(""); })}>
              <Icon name="plus" size={16} /> أضف النص
            </button>
          </div>
        </details>
      </section>

      <aside className="space-y-3">
        <div className="jw-panel space-y-2 p-4">
          <h2 className="font-semibold">مدخلات المادة ({sources.length})</h2>
          {sources.length === 0 && <p className="text-sm text-jw-muted">لا شيء بعد. 💡 صوّر كل صفحة صورة واضحة ومستقيمة، أو ارفع ملف PDF، ثم اضغط «استخرج النص».</p>}
          <ol className="space-y-2">
            {sources.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 rounded-lg bg-jw-surface-2 p-2 text-sm">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-jw-surface-3 text-xs">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate">{s.name || KIND[s.kind]}</b>
                  <span className="text-xs text-jw-muted">
                    {KIND[s.kind]}
                    {s.kind === "pdf" && s.pages ? ` · ${s.pages} صفحة` : ""}
                    {s.status === "pending" ? " · لم يكتمل الرفع" : s.status === "rejected" ? " · مرفوض" : s.kind === "pdf" ? ` · قُرئ ${s.pagesDone} من ${s.pages}` : s.pagesDone ? " · قُرئ" : ""}
                  </span>
                </span>
                {s.kind !== "text" && s.status === "ready" && (
                  <a className="jw-btn jw-btn-quiet jw-btn-icon" href={`/api/jawad/student/projects/${project.id}/source/${s.id}`} target="_blank" rel="noreferrer" aria-label="فتح الملف">
                    <Icon name="eye" size={14} />
                  </a>
                )}
                <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأعلى" onClick={() => move(s.id, -1)} disabled={i === 0 || busy}>
                  <Icon name="chevronDown" size={14} className="rotate-180" />
                </button>
                <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأسفل" onClick={() => move(s.id, 1)} disabled={i === sources.length - 1 || busy}>
                  <Icon name="chevronDown" size={14} />
                </button>
                <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="حذف" onClick={() => confirm("حذف هذا المدخل ونصه المستخرج؟") && run(() => p.act({ action: "source_remove", sourceId: s.id }))} disabled={busy || running}>
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ol>
          <ErrorLine error={error} />
        </div>

        <div className="jw-panel space-y-3 p-4">
          <h2 className="font-semibold">استخراج النص</h2>
          <p className="text-sm text-jw-muted">
            النص المكتوب يُحفظ كما هو. الصور وصفحات PDF يقرؤها المساعد حرفيًا صفحة صفحة، ويعلّم الكلمات غير المقروءة بـ ⟦؟⟧ بدل تخمينها. القراءة الآلية ليست دقيقة 100٪، لذلك ستراجع النص كاملًا بعدها.
          </p>
          <JobStatus job={job && (job.status !== "succeeded" ? job : undefined)} />
          {pending.length > 0 ? (
            <div className={running || busy ? "" : "st-attention rounded-xl"}>
              <PaidButton label={segments.length ? "أكمل الاستخراج" : "استخرج النص"} what={`قراءة ${pending.length} مدخل (الصور وصفحات PDF عبر Claude).`} disabled={running} run={(b) => p.act({ action: "extract", ...b })} />
            </div>
          ) : sources.length > 0 && segments.length > 0 ? (
            <p className="text-sm text-jw-ok">
              <Icon name="check" size={14} className="inline" /> استُخرج كل شيء. انتقل إلى «مراجعة النص».
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
