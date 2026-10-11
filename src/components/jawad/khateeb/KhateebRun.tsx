"use client";

// «الخطيب الذكي» — one sermon on the Sheikh's own journey (not the student's steps): the preacher's request at the top, then
// what «الشيخ» is doing, step by step, by himself (next.ts), and the finished sermon with its files at the end.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/components/jawad/Icon";
import Riyal from "@/components/Riyal";
import RobotFace from "@/components/RobotFace";
import { isResearchSource } from "@config/jawad/student";
import { readSermonLength, SERMON_FORMATS } from "@config/jawad/khateeb";
import { useBranch } from "@/components/jawad/student/branch";
import { useProject, type ProjectState } from "@/components/jawad/student/client";
import { useAutopilot } from "@/components/jawad/student/autopilot";
import OutputPanel from "@/components/jawad/student/OutputPanel";
import SadiqChat from "@/components/jawad/student/SadiqChat";
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
  const chat = outputs.find((x) => x.kind === "chat");
  const [openingChat, setOpeningChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const sp = sermonOf(o);
  const topic = sp && sp.chosen >= 0 ? sp.topics[sp.chosen] : null;
  const hasText = o?.status === "done" || o?.status === "review";
  // the written text waits for the preacher's approval before the PDF / Word are made
  const draft = hasText && Boolean((o?.content as { draft?: boolean } | null)?.draft);
  const finished = hasText && !draft;
  const running = jobs.find((j) => j.status === "queued" || j.status === "running");

  // he starts by himself when the page opens (and carries on where he stopped); after a stop, «كمّل» starts him again
  const { start } = auto;
  const started = useRef(false);
  useEffect(() => {
    if (started.current || hasText) return;
    started.current = true;
    start("all");
  }, [hasText, start]);

  const own = Boolean(ask.draftText);
  const researched = own ? sources.length > 0 : sources.some((x) => isResearchSource(x.name));
  const understood = project.stage === "outputs";
  const planned = o?.planApproved ?? false;
  const steps: { emoji: string; title: string; state: State; detail: string }[] = [
    { emoji: "📜", title: own ? "يقرأ نص خطبتك" : "يبحث في نصوص الموضوع", state: researched ? "done" : "now", detail: researched ? (own ? "نصك هو المادة، ويطابقه على القواعد" : "كتب نصوص الموضوع من مصادرها") : "" },
    { emoji: "🧠", title: "يقرأ النصوص ويفهمها", state: understood ? "done" : researched ? "now" : "wait", detail: understood && p.state.understanding ? p.state.understanding.content.topic : "" },
    { emoji: "📖", title: "الآية المفتاح", state: topic ? "done" : understood ? "now" : "wait", detail: topic ? `${topic.title} — ${topic.verse.ref}` : "" },
    {
      emoji: "📚",
      title: "التفسير من مجمع البيان",
      state: sp?.tafsir ? "done" : sp?.tafsirMissing ? "skip" : topic ? "now" : "wait",
      detail: sp?.tafsir ? sp.tafsir.source : sp?.tafsirMissing ? (ask.tafsir.length ? "ما لقى صفحات تفسير الآية، فالخطبة بدون تفسير لها" : "بدون تفسير (حسب اختيارك)") : "",
    },
    {
      emoji: "🪶",
      title: "الأبيات (الشطرين) من مراجع الشعر",
      state: !ask.poetryIds.length ? "skip" : sp?.poems ? (sp.poems.length ? "done" : "skip") : topic ? "now" : "wait",
      detail: !ask.poetryIds.length ? "ما اخترت مراجع شعر" : sp?.poems ? (sp.poems.length ? `${sp.poems.length} مقطع بنصه ورقم صفحته` : "ما لقى أبياتًا مناسبة في المراجع") : "",
    },
    {
      emoji: "📕",
      title: "الروايات والقصص من كتب المكتبة",
      state: !ask.sourceIds.length ? "skip" : sp?.sources ? (sp.sources.length ? "done" : "skip") : topic ? "now" : "wait",
      detail: !ask.sourceIds.length ? "ما اخترت كتبًا" : sp?.sources ? (sp.sources.length ? `${sp.sources.length} مقطع بنصه ورقم صفحته` : "ما لقى شواهد مناسبة في المصادر") : "",
    },
    { emoji: "✍️", title: "يكتب نص الخطبة على منهج المرجعية", state: hasText ? "done" : planned ? "now" : "wait", detail: hasText ? "المقدمة · صلب المجلس · الخاتمة والتخلّص · الرثاء" : "" },
    { emoji: "🕌", title: "يصنع الملف بعد اعتمادك للنص", state: finished ? "done" : draft ? "now" : "wait", detail: draft ? "بانتظارك: اقرأ النص تحت واعتمده" : finished ? SERMON_FORMATS.find((f) => f.id === ask.format)?.label ?? "" : "" },
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
          <RobotFace id={face} size={34} /> {finished ? `${A} خلّص خطبتك` : draft ? `${A} كتب النص — اقرأه واعتمده` : `${A} يحضّر خطبتك`}
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
        {!hasText &&
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

      {/* what the Sheikh took, before the text: the preacher reads it all, then approves */}
      {hasText && topic && (
        <section className="jw-panel st-rise space-y-3 p-5" aria-label="ما أخذه الشيخ">
          <h2 className="st-section-title text-lg">ما أخذه {A} للخطبة</h2>
          <div className="space-y-1 text-sm">
            <p>
              <b>الآية المفتاح:</b> {topic.verse.ref}
            </p>
            <p className="rounded-xl bg-white/70 p-3 leading-8">{topic.verse.text}</p>
            <p>
              <b>الزاوية:</b> {topic.title} — <span className="text-jw-muted">{topic.idea}</span>
            </p>
            <p>
              <b>نقطة التخلّص:</b> <span className="text-jw-muted">{topic.kooriz}</span>
            </p>
            <p>
              <b>التفسير:</b> {sp?.tafsir ? sp.tafsir.source : "بدون"}
            </p>
            {(sp?.poems?.length ?? 0) > 0 && (
              <details>
                <summary className="cursor-pointer font-bold">الأبيات ({sp!.poems!.length})</summary>
                <ul className="mt-1 space-y-2">
                  {sp!.poems!.map((x, i) => (
                    <li key={i} className="rounded-xl bg-white/70 p-3 whitespace-pre-line">
                      {x.text}
                      <span className="mt-1 block text-xs text-jw-muted">
                        {x.poet ? `${x.poet} · ` : ""}
                        {x.ref}، ص{x.page}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {(sp?.sources?.length ?? 0) > 0 && (
              <details>
                <summary className="cursor-pointer font-bold">الروايات والقصص ({sp!.sources!.length})</summary>
                <ul className="mt-1 space-y-2">
                  {sp!.sources!.map((x, i) => (
                    <li key={i} className="rounded-xl bg-white/70 p-3 whitespace-pre-line">
                      {x.text}
                      <span className="mt-1 block text-xs text-jw-muted">
                        {x.ref}، ص{x.page}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        </section>
      )}

      {/* the text (to read, and to ask for changes), then its files */}
      {o && hasText && <OutputPanel key={o.id} p={p} o={o} onRemade={() => start("all")} />}

      {/* the end: a conversation with the Sheikh, for what the preacher wants that is special or particular */}
      {hasText && (
        <section className="jw-panel st-rise space-y-3 p-5" aria-labelledby="chat">
          <h2 id="chat" className="st-section-title flex items-center gap-2 text-lg">
            <RobotFace id={face} size={30} /> تبي أشغّل لك المحادثة مع {A}؟
          </h2>
          {chat ? (
            <SadiqChat key={chat.id} p={p} o={chat} />
          ) : (
            <>
              <p className="text-sm text-jw-muted">تكمل له وش تبي: شي خاص أو معين في الخطبة. وهو ماشي على قوانينه وطريقتنا، ويشوف الآية والتفسير والأبيات والنص.</p>
              <button
                type="button"
                className="jw-btn jw-btn-primary"
                disabled={openingChat}
                onClick={async () => {
                  setOpeningChat(true);
                  setChatError(null);
                  try {
                    await p.act({ action: "outputs_add", kinds: ["chat"] });
                  } catch (e) {
                    setChatError(e instanceof Error ? e.message : String(e));
                  } finally {
                    setOpeningChat(false);
                  }
                }}
              >
                {openingChat ? <span className="jw-spinner" aria-hidden /> : <Icon name="plus" size={16} />} نعم، شغّل المحادثة
              </button>
              <ErrorLine error={chatError} />
            </>
          )}
        </section>
      )}
    </div>
  );
}
