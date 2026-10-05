"use client";

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, Gate, JobStatus, PaidButton, useAsync } from "./ui";

function Q({ value, set, yes, no }: { value: boolean | null; set: (v: boolean) => void; yes: string; no: string }) {
  return (
    <div className="jw-seg flex-wrap" role="radiogroup">
      <button type="button" role="radio" aria-checked={value === false} onClick={() => set(false)}>
        {no}
      </button>
      <button type="button" role="radio" aria-checked={value === true} onClick={() => set(true)}>
        {yes}
      </button>
    </div>
  );
}

export default function ScopeStep({ p }: { p: ProjectHook }) {
  const { project, research, jobs } = p.state;
  const [add, setAdd] = useState<boolean | null>(project.allow_additions);
  const [web, setWeb] = useState<boolean | null>(project.web_search);
  const [focus, setFocus] = useState("");
  const { busy, error, run } = useAsync();
  const job = jobs.find((j) => j.kind === "research");
  const running = jobs.some((j) => j.status === "queued" || j.status === "running");
  const same = project.allow_additions === add && project.web_search === web && add !== null;
  // saved and moved on (after a new understanding the same answers are confirmed again)
  const saved = same && (project.stage !== "scope" || Boolean(project.web_search));

  return (
    <div className="space-y-4">
      <section className="jw-panel space-y-4 p-4">
        <div className="space-y-2">
          <h2 className="font-semibold">١. هل تلتزم بما في المادة فقط، أم تسمح بشرح وإضافات من معرفة المساعد؟</h2>
          <Q value={add} set={setAdd} no="المادة فقط" yes="أسمح بالإضافات" />
          <p className="text-xs text-jw-faint">
            {add ? "أي إضافة تظهر في الملفات مفصولة وموسومة «إضافة من المساعد — ليست من المادة»." : "لن تُدخل أي حقيقة أو مثال من خارج المادة؛ إعادة الصياغة والتبسيط لما فيها مسموحة."}
          </p>
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">٢. هل تريد بحثًا خارجيًا في الويب عن الموضوع؟</h2>
          <Q value={web} set={setWeb} no="لا" yes="نعم، ابحث" />
          <p className="text-xs text-jw-faint">البحث حقيقي عبر أداة البحث في Claude، مع روابط كل مصدر وتاريخ الاطلاع عليه. نتائجه لا تغيّر نصك المعتمد، وتظهر موسومة «من البحث الخارجي».</p>
        </div>
        <ErrorLine error={error} />
        <button type="button" className="jw-btn jw-btn-primary" disabled={add === null || web === null || busy || saved} onClick={() => run(() => p.act({ action: "scope", allowAdditions: add, webSearch: web }))}>
          <Icon name="check" size={16} /> {saved ? "محفوظ" : "احفظ الإجابتين"}
        </button>
      </section>

      {project.web_search && same && (
        <section className="space-y-3">
          <JobStatus job={job && job.status !== "succeeded" ? job : undefined} />
          {!research ? (
            <div className="jw-panel space-y-3 p-4">
              <h2 className="font-semibold">البحث الخارجي</h2>
              <label className="jw-label" htmlFor="focus">ما الذي تريد أن يركّز عليه البحث؟ (اختياري)</label>
              <input id="focus" className="jw-input" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="مثال: أمثلة حديثة، تعريفات، إحصائيات" />
              <PaidButton label="ابحث" what="بحث في الويب (حتى 8 عمليات بحث) وكتابة ما تضيفه المصادر مع روابطها." disabled={running} run={(b) => p.act({ action: "research", focus, ...b })} />
            </div>
          ) : (
            <>
              <article className="jw-panel space-y-3 p-4">
                <h2 className="font-semibold">نتيجة البحث {research.approved && <span className="jw-chip !text-jw-ok">معتمدة</span>}</h2>
                {research.content.sources.length === 0 && <p className="text-sm text-jw-warn">لم يُعثر على مصادر موثوقة. لن يُستخدم البحث في النواتج.</p>}
                {research.content.paragraphs.map((para, i) => (
                  <p key={i} className="text-sm leading-7">
                    {para.text}{" "}
                    {para.cites.map((c) => (
                      <a key={c} href={research.content.sources[c]?.url} target="_blank" rel="noreferrer" className="text-xs text-jw-accent">
                        [{c + 1}]
                      </a>
                    ))}
                  </p>
                ))}
                {research.content.sources.length > 0 && (
                  <ol className="list-inside list-decimal space-y-1 border-t border-jw-line pt-2 text-xs text-jw-muted">
                    {research.content.sources.map((s, i) => (
                      <li key={i}>
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-jw-accent underline" dir="auto">
                          {s.title}
                        </a>{" "}
                        · اطّلع عليه {new Date(s.accessedAt).toLocaleDateString("ar")}
                        {s.pageAge ? ` · تاريخ الصفحة: ${s.pageAge}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-xs text-jw-faint">{research.content.searches} عملية بحث.</p>
              </article>
              <Gate
                next="تنتقل إلى اختيار النواتج، ويُستخدم هذا البحث موسومًا ومنفصلًا عن مادتك."
                approveLabel={research.approved ? "متابعة" : "اعتمد البحث"}
                onApprove={() => p.act({ action: "research_approve" })}
                editLabel="ابحث من جديد"
                editHint="ما الذي تريد أن يركّز عليه البحث الجديد؟"
                onEdit={(note) => <PaidButton label="ابحث من جديد" what="بحث جديد بالتركيز الذي كتبته." disabled={running} run={(b) => p.act({ action: "research", focus: note, ...b })} />}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
}
