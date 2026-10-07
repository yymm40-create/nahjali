"use client";

// «الطالب الذكي» · «صادق يبحث لي»: no upload page. What the first page asked is researched, written as the
// material, read and understood by the assistant on its own (the page's autopilot), and the student arrives at the
// outputs. Shown here: where it is, and a way to start it again if something stopped it.

import { isResearchSource } from "@config/jawad/student";
import { useState } from "react";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, JobStatus, PaidButton } from "./ui";

export default function ResearchRun({ p, working, error, onGo, onFiles }: { p: ProjectHook; working: string | null; error: string | null; onGo: () => void; onFiles: () => void }) {
  const { project, sources, jobs } = p.state;
  const job = jobs.find((j) => (j.kind === "research" || j.kind === "extract" || j.kind === "understand") && j.status !== "succeeded");
  const written = sources.some((s) => s.kind === "text" && isResearchSource(s.name));
  const searching = jobs.some((j) => j.kind === "research" && (j.status === "queued" || j.status === "running"));
  const [focus, setFocus] = useState(project.brief.focus || project.title);
  const [where, setWhere] = useState(project.brief.where);

  const at = !written ? 0 : project.stage === "understanding" ? 2 : 1;
  const steps = ["🔎 صادق يبحث ويكتب مادتك", "📖 يقرأ المادة", "🧠 يفهمها", "✨ تختار نواتجك"];
  const stopped = !working && !searching && !job;

  return (
    <section className="jw-panel space-y-5 p-6">
      <ol className="grid gap-2 sm:grid-cols-4">
        {steps.map((s, i) => (
          <li key={s} className={`rounded-2xl border p-3 text-center text-sm ${i < at ? "border-jw-ok/40 bg-jw-ok/10" : i === at ? "border-transparent bg-white font-bold ring-4 ring-violet-200" : "border-jw-line text-jw-muted"}`}>
            {i < at ? "✓ " : ""}
            {s}
          </li>
        ))}
      </ol>
      <JobStatus job={job} />
      {working && (
        <p className="flex items-center justify-center gap-2 text-sm font-semibold" role="status">
          <span className="jw-spinner" aria-hidden /> {working}
        </p>
      )}
      <ErrorLine error={error} />

      {!written && !searching && (
        <div className="space-y-3 rounded-2xl bg-jw-surface-2 p-4">
          <b className="block">ابدأ البحث</b>
          <textarea className="jw-textarea" rows={2} value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="وش تبي صادق يبحث عنه؟" aria-label="ما يبحث عنه صادق" />
          <textarea className="jw-textarea" rows={2} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="وين يبحث؟ (اختياري) روابط أو مصادر يلتزم فيها" aria-label="وين يبحث صادق" />
          <PaidButton
            label="ابحث واكتب مادتي"
            what="بحث في الويب وكتابة المادة بمصادرها، ثم قراءتها وفهمها."
            disabled={!focus.trim()}
            run={async (b) => {
              const r = await p.act({ action: "research_material", focus, where, ...b });
              if (b.confirm) onGo();
              return r;
            }}
          />
        </div>
      )}
      {written && stopped && (
        <button type="button" className="jw-btn jw-btn-primary mx-auto block" onClick={onGo}>
          كمّل
        </button>
      )}
      <p className="text-center text-xs text-jw-faint">
        تبي تستخدم ملفاتك بدل البحث؟{" "}
        <button type="button" className="underline" onClick={onFiles}>
          أضف ملفاتك
        </button>
      </p>
    </section>
  );
}
