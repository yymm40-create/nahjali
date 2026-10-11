"use client";

// «الخطيب الذكي» — one sermon on the Sheikh's own journey (not the student's steps): the preacher's request at the top, then
// what «الشيخ» is doing, step by step, by himself (next.ts), and the finished sermon with its files at the end.

import Link from "next/link";
import { useEffect, useRef } from "react";
import Icon from "@/components/jawad/Icon";
import Riyal from "@/components/Riyal";
import RobotFace from "@/components/RobotFace";
import { isResearchSource } from "@config/jawad/student";
import { readSermonLength, SERMON_FORMATS } from "@config/jawad/khateeb";
import { useBranch } from "@/components/jawad/student/branch";
import { useProject, type ProjectState } from "@/components/jawad/student/client";
import { useAutopilot } from "@/components/jawad/student/autopilot";
import OutputPanel from "@/components/jawad/student/OutputPanel";
import { ErrorLine } from "@/components/jawad/student/ui";
import { nextKhateeb, sermonOf } from "./next";

type State = "done" | "now" | "wait" | "skip";

export default function KhateebRun({ initial }: { initial: ProjectState }) {
  const { assistant: A, base, face } = useBranch();
  const p = useProject(initial);
  const auto = useAutopilot(p.state, p.busy, p.refresh, A, nextKhateeb);
  const { project, sources, outputs, jobs } = p.state;
  const ask = project.brief.sermon!;
  const o = outputs.find((x) => x.kind === "sermon");
  const sp = sermonOf(o);
  const topic = sp && sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
  const finished = o?.status === "done" || o?.status === "review";
  const running = jobs.find((j) => j.status === "queued" || j.status === "running");

  // he starts by himself when the page opens (and carries on where he stopped); after a stop, «كمّل» starts him again
  const { start } = auto;
  const started = useRef(false);
  useEffect(() => {
    if (started.current || finished) return;
    started.current = true;
    start("all");
  }, [finished, start]);

  const researched = sources.some((x) => isResearchSource(x.name));
  const understood = project.stage === "outputs";
  const planned = o?.planApproved ?? false;
  const steps: { emoji: string; title: string; state: State; detail: string }[] = [
    { emoji: "📜", title: "يبحث في نصوص الموضوع", state: researched ? "done" : "now", detail: researched ? "كتب نصوص الموضوع من مصادرها" : "" },
    { emoji: "🧠", title: "يقرأ النصوص ويفهمها", state: understood ? "done" : researched ? "now" : "wait", detail: understood && p.state.understanding ? p.state.understanding.content.topic : "" },
    { emoji: "📖", title: "الآية المفتاح", state: topic ? "done" : understood ? "now" : "wait", detail: topic ? `${topic.title} — ${topic.verse.ref}` : "" },
    {
      emoji: "📚",
      title: "التفسير من مجمع البيان",
      state: sp?.tafsir ? "done" : sp?.tafsirMissing ? "skip" : topic ? "now" : "wait",
      detail: sp?.tafsir ? sp.tafsir.source : sp?.tafsirMissing ? "ما لقى صفحات تفسير الآية، فالخطبة بدون تفسير لها" : "",
    },
    {
      emoji: "🪶",
      title: "الأبيات (الشطرين) من مراجع الشعر",
      state: !ask.poetry ? "skip" : sp?.poems ? (sp.poems.length ? "done" : "skip") : topic ? "now" : "wait",
      detail: !ask.poetry ? "ما طلبتها" : sp?.poems ? (sp.poems.length ? `${sp.poems.length} مقطع بنصه ورقم صفحته` : "ما لقى أبياتًا مناسبة في المراجع") : "",
    },
    {
      emoji: "📕",
      title: "القصص والشواهد من المصادر",
      state: !ask.sources ? "skip" : sp?.sources ? (sp.sources.length ? "done" : "skip") : topic ? "now" : "wait",
      detail: !ask.sources ? "ما طلبتها" : sp?.sources ? (sp.sources.length ? `${sp.sources.length} مقطع بنصه ورقم صفحته` : "ما لقى شواهد مناسبة في المصادر") : "",
    },
    { emoji: "🕌", title: "يكتب الخطبة على منهج المرجعية", state: finished ? "done" : planned ? "now" : "wait", detail: finished ? "المقدمة · صلب المجلس · الخاتمة والتخلّص · الرثاء" : "" },
  ];
  // only the first step not done yet is "now"
  const first = steps.findIndex((s) => s.state === "now");
  steps.forEach((s, i) => {
    if (s.state === "now" && i !== first) s.state = "wait";
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6" data-st-project={project.id}>
      <header className="st-rise flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link href={base} className="jw-btn jw-btn-icon" aria-label="خطبي">
            <Icon name="chevronRight" size={18} />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold">{ask.topic}</h1>
            <p className="text-xs text-jw-faint">تُحذف {new Date(project.expiresAt).toLocaleDateString("ar")} إن لم تُستخدم</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {p.state.balance !== null && (
            <span className="jw-chip !px-3 !py-1 !text-sm" aria-label="رصيدك">
              <Riyal halalas={p.state.balance} size={16} />
            </span>
          )}
          <button
            type="button"
            className="jw-btn jw-btn-quiet jw-btn-icon !text-jw-danger"
            aria-label="حذف الخطبة"
            title="حذف الخطبة"
            onClick={async () => {
              if (!confirm("حذف هذه الخطبة وكل ملفاتها نهائيًا؟")) return;
              try {
                await p.act({ action: "delete" });
                window.location.href = base;
              } catch (e) {
                alert(`ما انحذفت: ${e instanceof Error ? e.message : String(e)}`);
              }
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        </div>
      </header>

      {/* the preacher's request */}
      <section className="jw-panel st-rise space-y-2 p-5" aria-label="طلبك">
        <p className="text-sm">
          <b>الغاية:</b> {ask.goal || "—"}
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-jw-muted">
          {ask.occasion && <span>المناسبة: {ask.occasion}</span>}
          <span>الطول: {readSermonLength(ask.length).label} (≈ {readSermonLength(ask.length).minutes} دقيقة)</span>
          <span>الملف: {SERMON_FORMATS.find((f) => f.id === ask.format)?.label}</span>
        </p>
      </section>

      {/* what the Sheikh is doing */}
      <section className="jw-panel st-rise space-y-4 p-5" aria-labelledby="run" aria-live="polite">
        <h2 id="run" className="st-section-title flex items-center gap-2 text-xl">
          <RobotFace id={face} size={34} /> {finished ? `${A} خلّص خطبتك` : `${A} يحضّر خطبتك`}
        </h2>
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.title} className={`flex items-start gap-3 rounded-2xl border p-3 ${s.state === "now" ? "border-jw-accent-line bg-jw-accent-soft" : "border-jw-line bg-white/60"} ${s.state === "wait" ? "opacity-55" : ""}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-jw-surface-2 text-lg" aria-hidden>
                {s.state === "done" ? <Icon name="check" size={18} /> : s.state === "now" && auto.mode ? <span className="jw-spinner" /> : s.emoji}
              </span>
              <span className="min-w-0">
                <b className="block text-sm">{s.title}</b>
                {s.detail && <span className="block text-xs break-words text-jw-muted">{s.detail}</span>}
                {s.state === "now" && running?.stage && <span className="block text-xs text-jw-accent">{running.stage}</span>}
              </span>
            </li>
          ))}
        </ol>
        {!finished &&
          (auto.mode ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-jw-muted">{auto.doing ? `${A} ${auto.doing}…` : `${A} شغّال…`}</span>
              <button type="button" className="jw-btn jw-btn-quiet" onClick={auto.stop}>
                أوقف
              </button>
            </div>
          ) : (
            <button type="button" className="jw-btn jw-btn-primary w-full sm:w-auto" onClick={() => start("all")}>
              كمّل — {A} يكمل من حيث وقف
            </button>
          ))}
        <ErrorLine error={auto.error ?? (!auto.mode && o?.status === "failed" ? o.error : null)} />
      </section>

      <ErrorLine error={p.error} />

      {/* the finished sermon: its files, and asking for a change */}
      {o && finished && <OutputPanel key={o.id} p={p} o={o} onRemade={() => start("all")} />}
    </div>
  );
}
