"use client";

import Icon from "@/components/jawad/Icon";
import type { ProjectHook } from "./StudentProject";
import { Gate, JobStatus, PaidButton } from "./ui";

export default function UnderstandingStep({ p }: { p: ProjectHook }) {
  const { understanding, project, jobs, segments } = p.state;
  const job = jobs.find((j) => j.kind === "understand");
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");
  const current = understanding && understanding.content.basedOnText === project.text_version ? understanding : null;
  const label = new Map(segments.map((s) => [s.sid, s.label]));
  const where = (ids: string[]) => {
    const names = ids.map((x) => label.get(x) ?? x);
    return names.length > 4 ? `${names.slice(0, 2).join("، ")} … ${names[names.length - 1]} (${names.length} أجزاء)` : names.join("، ");
  };

  return (
    <div className="space-y-4">
      <JobStatus job={job && job.status !== "succeeded" ? job : undefined} />
      {!current ? (
        <div className="jw-panel space-y-3 p-4">
          <h2 className="font-semibold">فهم المساعد للمادة</h2>
          <p className="text-sm text-jw-muted">
            يقرأ المساعد النص المعتمد كاملًا على أجزاء، ويكتب ملاحظة لكل جزء حتى لا يتجاوز شيئًا، ثم يجمعها في فهم واحد: موضوع المادة، بنيتها، أجزاؤها، المواضع الملتبسة، وما لا يستطيع تأكيده. لا تُقترح النواتج قبل أن تعتمد هذا الفهم.
          </p>
          <PaidButton label="اعرض فهم المساعد" what="قراءة المادة كاملة وبناء الفهم (Claude)." disabled={running} run={(b) => p.act({ action: "understand", ...b })} />
        </div>
      ) : (
        <>
          <article className="jw-panel space-y-4 p-4">
            <header className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold">{current.content.topic}</h2>
                <span className="jw-chip">{current.content.materialType}</span>
                {current.approved && <span className="jw-chip !text-jw-ok">معتمد</span>}
              </div>
              <p className="text-jw-muted">{current.content.overview}</p>
            </header>
            <section>
              <h3 className="mb-2 font-semibold">بنية المادة</h3>
              <ol className="space-y-2">
                {current.content.sections.map((s, i) => (
                  <li key={i} className="rounded-lg bg-jw-surface-2 p-3">
                    <b>
                      {i + 1}. {s.title}
                    </b>
                    <p className="text-sm">{s.about}</p>
                    <p className="text-xs text-jw-faint">من: {where(s.segments)}</p>
                  </li>
                ))}
              </ol>
            </section>
            {current.content.ambiguous.length > 0 && (
              <section>
                <h3 className="mb-1 font-semibold text-jw-warn">مواضع ملتبسة</h3>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {current.content.ambiguous.map((a, i) => (
                    <li key={i}>
                      {a.note} <span className="text-xs text-jw-faint">({where(a.segments)})</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {current.content.unsure.length > 0 && (
              <section>
                <h3 className="mb-1 font-semibold">ما لا يستطيع المساعد تأكيده</h3>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {current.content.unsure.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              </section>
            )}
            <p className={`text-sm ${current.content.coverage.missing.length ? "text-jw-warn" : "text-jw-ok"}`}>
              <Icon name="check" size={14} className="inline" /> التغطية: {current.content.coverage.covered} من {current.content.coverage.total} جزءًا مذكور في البنية
              {current.content.coverage.missing.length ? ` — أُضيف الباقي في قسم مستقل: ${current.content.coverage.missing.join("، ")}` : ""}
            </p>
          </article>

          <Gate
            next="ينتقل إلى سؤالي حدود المصدر: الإضافة من معرفة المساعد، والبحث الخارجي."
            approveLabel={current.approved ? "متابعة" : "اعتمد الفهم"}
            onApprove={() => p.act({ action: "understanding_approve" })}
            editHint="ما الذي فهمه المساعد خطأ أو ناقصًا؟"
            onEdit={(note) => <PaidButton label="أرسل التعديل" what="يعيد المساعد بناء الفهم مع ملاحظتك (بدون إعادة قراءة المادة)." disabled={running} run={(b) => p.act({ action: "understand", note, kind: "edit", ...b })} />}
            onOther={(note) => <PaidButton label="أرسل الطلب" what="يعيد المساعد بناء الفهم مع طلبك الجديد." disabled={running} run={(b) => p.act({ action: "understand", note, kind: "other", ...b })} />}
          />
        </>
      )}
    </div>
  );
}
