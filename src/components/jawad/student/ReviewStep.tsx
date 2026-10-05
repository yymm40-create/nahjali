"use client";

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, Gate, useAsync } from "./ui";

/** The whole extracted text, part by part: each part is reviewed and approved, then the full text. */
export default function ReviewStep({ p }: { p: ProjectHook }) {
  const { segments, coverage, project } = p.state;
  const firstOpen = Math.max(0, segments.findIndex((s) => s.status !== "approved"));
  const [i, setI] = useState(firstOpen);
  const seg = segments[Math.min(i, segments.length - 1)];
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const { busy, error, run } = useAsync();

  if (!segments.length) return <p className="jw-panel p-4 text-sm text-jw-muted">لا يوجد نص بعد. أضف المادة واستخرج النص أولًا.</p>;
  const text = draft?.id === seg.id ? draft.text : seg.text;
  const dirty = draft?.id === seg.id && draft.text !== seg.text;
  const go = (k: number) => {
    setDraft(null);
    setShowRaw(false);
    setI(Math.max(0, Math.min(segments.length - 1, k)));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            الجزء {i + 1} من {segments.length} · <span className="text-jw-muted">{seg.label}</span>
          </h2>
          <span className={`jw-chip ${seg.status === "approved" ? "!text-jw-ok" : ""}`}>{seg.status === "approved" ? "معتمد" : "ينتظر المراجعة"}</span>
        </div>
        <p className="text-xs text-jw-muted">💡 قارن النص بكتابك وصحّح أي خطأ، ثم اضغط «اعتمد». الكلمات بين ⟦ ⟧ ما اتضحت: اكتبها مثل ما في الكتاب.</p>
        {seg.uncertain.length > 0 && (
          <div className="rounded-lg border border-jw-warn/40 bg-jw-warn/10 p-3 text-sm">
            <b className="mb-1 block text-jw-warn">مواضع تحتاج مراجعتك (معلّمة في النص بـ ⟦ ⟧):</b>
            <ul className="list-inside list-disc space-y-0.5">
              {seg.uncertain.map((u, k) => (
                <li key={k}>{u}</li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          className="jw-textarea min-h-[50vh] font-[family-name:var(--jw-font)] text-base"
          dir="auto"
          value={text}
          onChange={(e) => setDraft({ id: seg.id, text: e.target.value })}
          aria-label={`نص ${seg.label}`}
        />
        {seg.raw !== seg.text && (
          <button type="button" className="text-xs text-jw-muted underline" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? "إخفاء" : "عرض"} النص المستخرج الأولي (قبل تعديلاتك)
          </button>
        )}
        {showRaw && <pre className="jw-panel max-h-80 overflow-auto whitespace-pre-wrap p-3 text-sm text-jw-muted" dir="auto">{seg.raw}</pre>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="jw-btn jw-btn-quiet" onClick={() => go(i - 1)} disabled={i === 0}>
            <Icon name="chevronRight" size={16} /> السابق
          </button>
          <button
            type="button"
            className="jw-btn jw-btn-primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await p.act({ action: "segment_approve", segmentId: seg.id, ...(dirty ? { text } : {}) });
                setDraft(null);
                if (i < segments.length - 1) go(i + 1);
              })
            }
          >
            <Icon name="check" size={16} /> {dirty ? "احفظ واعتمد" : "اعتمد"} {i < segments.length - 1 ? "وانتقل للتالي" : ""}
          </button>
          {dirty && (
            <button type="button" className="jw-btn" disabled={busy} onClick={() => run(async () => { await p.act({ action: "segment_save", segmentId: seg.id, text }); setDraft(null); })}>
              احفظ التعديل فقط
            </button>
          )}
          {seg.status === "approved" && !dirty && (
            <button type="button" className="jw-btn jw-btn-quiet" disabled={busy} onClick={() => run(() => p.act({ action: "segment_reopen", segmentId: seg.id }))}>
              ألغِ اعتماد هذا الجزء
            </button>
          )}
          <button type="button" className="jw-btn jw-btn-quiet" onClick={() => go(i + 1)} disabled={i === segments.length - 1}>
            التالي <Icon name="chevronLeft" size={16} />
          </button>
        </div>
        <ErrorLine error={error} />
      </section>

      <aside className="space-y-3">
        <div className="jw-panel space-y-2 p-3">
          <h3 className="text-sm font-semibold">
            التقدم: {coverage.approved} من {coverage.total} معتمد
          </h3>
          <div className="flex flex-wrap gap-1" role="list" aria-label="الأجزاء">
            {segments.map((s, k) => (
              <button
                key={s.id}
                type="button"
                role="listitem"
                title={s.label}
                onClick={() => go(k)}
                className={`size-7 rounded text-[11px] ${k === i ? "ring-2 ring-jw-accent" : ""} ${s.status === "approved" ? "bg-jw-ok/25" : s.uncertain.length ? "bg-jw-warn/25" : "bg-jw-surface-3"}`}
              >
                {k + 1}
              </button>
            ))}
          </div>
          {coverage.approved < coverage.total && (
            <button
              type="button"
              className="jw-btn jw-btn-primary w-full"
              disabled={busy || dirty || coverage.missing.length > 0 || coverage.duplicate.length > 0}
              onClick={() =>
                run(async () => {
                  // one press: every remaining page approved as it is, then the whole text (a page can still be reopened later)
                  await p.act({ action: "segments_approve_all" });
                  await p.act({ action: "text_approve" });
                })
              }
            >
              <Icon name="check" size={16} /> اعتمد كل الصفحات وتابع ({coverage.total - coverage.approved} متبقية)
            </button>
          )}
          {dirty && <p className="text-xs text-jw-warn">احفظ تعديلك على الجزء الحالي أولًا.</p>}
        </div>

        <Gate
          next={project.text_version ? "تُنشأ نسخة نص جديدة، ويُطلب فهم المادة من جديد، وتُعلَّم النواتج المبنية على النسخة السابقة لإعادة الاعتماد." : "يُحفظ النص الكامل كنسخة معتمدة، ثم يقرأ المساعد المادة كلها ليعرض فهمه لها."}
          approveLabel="اعتمد النص الكامل"
          disabled={!coverage.complete}
          onApprove={() => p.act({ action: "text_approve" })}
        >
          <ul className="space-y-1 text-sm">
            <li className={coverage.approved === coverage.total ? "text-jw-ok" : "text-jw-muted"}>
              الأجزاء المعتمدة: {coverage.approved} من {coverage.total}
            </li>
            <li className={coverage.missing.length ? "text-jw-danger" : "text-jw-ok"}>
              {coverage.missing.length ? `صفحات لم تُستخرج: ${coverage.missing.slice(0, 6).join("، ")}${coverage.missing.length > 6 ? "…" : ""}` : "لا صفحة ناقصة"}
            </li>
            <li className={coverage.duplicate.length ? "text-jw-danger" : "text-jw-ok"}>{coverage.duplicate.length ? `مكرر: ${coverage.duplicate.join("، ")}` : "لا جزء مكرر"}</li>
          </ul>
        </Gate>
      </aside>
    </div>
  );
}
