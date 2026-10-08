"use client";

import { credits, creditsRange } from "@/lib/film/credits";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { api, postJson } from "@/lib/fetch";
import Markdown from "@/components/Markdown";
import Spinner from "@/components/Spinner";
import QuestionsForm from "../../QuestionsForm";
import ActionBar, { EditsLeftContext } from "../../ActionBar";
import type { ScriptVersion } from "@/lib/film/script";
import { KIND_LABELS, KIND_ORDER, type ScriptKind } from "@config/film-prompts/screenwriter";
import { STATUS_LABELS } from "@config/film";
import { useFilmBase } from "../../FilmBase";

interface Props {
  projectId: string;
  hasStory: boolean;
  versions: ScriptVersion[];
  job: { status: string; error: string | null } | null;
  stage: string;
  /** Edits left in this stage (the owner's limits); null = no limit. */
  editsLeft: number | null;
}

const COST_HINT = `كل رد من السيناريست ${creditsRange(0.05, 0.6)}`;

const chipClass = (s: string) =>
  s === "approved" ? "bg-teal text-white" : s === "awaiting_approval" ? "bg-gold text-on-gold" : "";

export default function ScriptWorkspace({ projectId, hasStory, versions, job, stage, editsLeft }: Props) {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [running, setRunning] = useState(job?.status === "running");
  const [sending, setBusy] = useState(false);
  // Busy until the new page data has arrived: the old screen's buttons can't be pressed a second time
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);
  const busy = sending || refreshing;
  const [error, setError] = useState("");

  // While the screenwriter writes, poll until the job finishes, then reload the page data
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null }>(`/api/film/projects/${projectId}/script`);
        if (s.status !== "running") {
          setRunning(false);
          refresh();
        }
      } catch {
        // keep polling; a network blip should not stop it
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [running, projectId, router, refresh]);

  // Once this section's last step is done, go straight to the next one (only when it happens here, not on later visits)
  const openedAt = useRef(stage);
  useEffect(() => {
    if (openedAt.current === "screenwriter" && stage === "sheets") router.push(`${filmBase}/${projectId}/sheets?start=1`);
  }, [stage, projectId, router, filmBase]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { jobId } = await postJson<{ jobId: string | null }>(`/api/film/projects/${projectId}/script`, body);
      if (jobId) setRunning(true);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const latest = (kind: ScriptKind) => versions.filter((v) => v.kind === kind).at(-1);
  // The handoff is built in the background and passed on to the next stage; it is not a step the user sees
  const shown = KIND_ORDER.filter((k) => k !== "handoff").map(latest).filter(Boolean) as ScriptVersion[];
  const current = [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at)).at(-1);
  const failed = job?.status === "failed" && !running;

  // Arrived from the project page (…/script?start=1): the screenwriter starts by itself, no second press
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || versions.length || running || failed || !hasStory || new URLSearchParams(window.location.search).get("start") !== "1") return;
    autoStarted.current = true;
    // only «start» is taken off the address (سجاد reads his own «research» mark)
    const u = new URL(window.location.href);
    u.searchParams.delete("start");
    window.history.replaceState(null, "", u.pathname + (u.search || ""));
    // (a moment, so the story's last words saved on the way here arrive first)
    const t = setTimeout(() => send({ action: "start" }), 900);
    return () => clearTimeout(t);
  });

  if (versions.length === 0 && !running && !failed) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <p className="text-5xl">✍️</p>
        <p className="font-bold">السيناريست بيقرأ قصتك ويعرض عليك فهمه أول، وما يكمّل إلا لما تكتب «اعتمد».</p>
        {!hasStory && (
          <p className="error-box">
            اكتب قصتك أول في <Link href={`${filmBase}/${projectId}`} className="underline">صفحة المشروع</Link>.
          </p>
        )}
        <button className="btn btn-primary w-full text-xl" disabled={!hasStory || busy} onClick={() => send({ action: "start" })}>
          {busy ? "نرسل…" : "ابدأ مع السيناريست"}
        </button>
        <p className="text-xs font-bold text-muted">{COST_HINT}</p>
        {error && <p className="error-box">{error}</p>}
      </div>
    );
  }

  return (
    <EditsLeftContext value={editsLeft}>
    <div className="space-y-4">
      {shown.map((v) => {
        const isCurrent = v.id === current?.id && v.status === "awaiting_approval";
        const older = versions.filter((x) => x.kind === v.kind && x.id !== v.id);
        return (
          <article key={v.id} className={`card space-y-3 p-5 ${isCurrent ? "border-2 border-gold" : ""}`}>
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold">
                {KIND_LABELS[v.kind]} <span className="text-sm text-muted">· النسخة {v.version}</span>
              </h2>
              <div className="flex gap-1">
                {v.stale && <span className="chip bg-red-500 text-white">قد تكون قديمة</span>}
                {typeof (v.data as { cost_usd?: unknown }).cost_usd === "number" && <span className="chip text-xs" title="تكلفة هذا الرد">{credits((v.data as { cost_usd: number }).cost_usd)}</span>}
                <span className={`chip ${chipClass(v.status)}`}>
                  {v.kind === "questions" && v.status === "approved" ? "تمت الإجابة" : STATUS_LABELS[v.status]}
                </span>
              </div>
            </header>

            {/* Questions waiting for answers are shown as a form instead of text */}
            {v.kind === "questions" && isCurrent ? (
              <QuestionsForm questions={v.data.questions ?? []} busy={busy || running} onSubmit={(answers) => send({ action: "answers", versionId: v.id, answers })} />
            ) : (
              <details open={isCurrent} className="group">
                <summary className="cursor-pointer text-sm font-extrabold text-muted group-open:hidden">اعرض النص</summary>
                <Markdown text={v.body} highlightRequests={isCurrent} />
                {v.kind === "questions" && v.data.answers && (
                  <div className="mt-3 rounded-2xl bg-surface-2 p-3 text-sm font-bold">
                    <p className="mb-1">إجاباتك:</p>
                    {v.data.answers.map((a, i) => <p key={i}>{i + 1}. {a}</p>)}
                  </div>
                )}
              </details>
            )}

            {v.data.notes && (
              <details className="rounded-2xl bg-surface-2 p-3 text-sm">
                <summary className="cursor-pointer font-extrabold">ملاحظات السيناريست</summary>
                <Markdown text={v.data.notes} />
              </details>
            )}

            {older.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-bold text-muted">النسخ السابقة ({older.length})</summary>
                <div className="mt-2 space-y-3">
                  {older.map((o) => (
                    <div key={o.id} className="rounded-2xl border border-line p-3 opacity-80">
                      <p className="mb-1 font-extrabold">النسخة {o.version} · {STATUS_LABELS[o.status]}</p>
                      <Markdown text={o.body} />
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Actions: approve on one side, edit / new direction on the other; edits stay possible after approval */}
            {v.kind !== "questions" && !running && (isCurrent || v.status === "approved") && (
              <ActionBar
                busy={busy}
                onApprove={isCurrent ? () => send({ action: "approve", versionId: v.id }) : undefined}
                onSend={(mode, text) => send({ action: "revise", text, versionId: v.id, mode })}
                warning={
                  v.status === "approved"
                    ? `${KIND_LABELS[v.kind]} معتمد. بعد التعديل، الأجزاء اللي بعده تنعلّم «قد تكون قديمة»، والسيناريست يوضح وش يتأثر ويحدّثه بموافقتك.${stage !== "screenwriter" ? " والسيناريو انتقل لصانع الشيت: الشيتات اللي انبنت عليه ما تتحدّث تلقائيًا." : ""}`
                    : undefined
                }
              />
            )}
          </article>
        );
      })}

      {running && (
        <div className="card flex items-center gap-3 p-5" role="status">
          <Spinner />
          <div>
            <p className="font-extrabold">{latest("screenplay")?.status === "approved" ? "ننقل السيناريو لصانع الشيت…" : "السيناريست يكتب…"}</p>
            <p className="text-sm font-bold text-muted">ممكن ياخذ من دقيقة إلى ٣ دقائق. لا تضغط شي، الصفحة بتتحدّث لحالها ⏳ وتقدر تسكّرها وترجع، الرد ينحفظ.</p>
          </div>
        </div>
      )}

      {failed && (
        <div className="card space-y-3 p-5">
          <p className="error-box">ما كمل الرد: {job?.error}. ما انحسبت عليك تكلفة.</p>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "retry" })}>
            أعد المحاولة
          </button>
        </div>
      )}

      {stage !== "screenwriter" && (
        <div className="card space-y-2 p-5 text-center">
          <p className="text-lg font-extrabold">✅ السيناريو معتمد وانتقل لصانع الشيت</p>
          <Link href={`${filmBase}/${projectId}/sheets`} className="btn btn-primary w-full">🎨 افتح صانع الشيت</Link>
        </div>
      )}

      {!running && <p className="text-center text-xs font-bold text-muted">{COST_HINT}</p>}
      {error && <p className="error-box">{error}</p>}
    </div>
    </EditsLeftContext>
  );
}
