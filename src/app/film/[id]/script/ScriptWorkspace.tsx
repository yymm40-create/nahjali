"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import Markdown from "@/components/Markdown";
import Spinner from "@/components/Spinner";
import type { ScriptVersion } from "@/lib/film/script";
import { KIND_LABELS, KIND_ORDER, type ScriptKind } from "@config/film-prompts/screenwriter";
import { STATUS_LABELS } from "@config/film";

interface Props {
  projectId: string;
  hasStory: boolean;
  versions: ScriptVersion[];
  job: { status: string; error: string | null } | null;
  stage: string;
}

const COST_HINT = "كل رد من السيناريست يكلف تقريبًا من $0.05 إلى $0.60";

const chipClass = (s: string) =>
  s === "approved" ? "bg-teal text-white" : s === "awaiting_approval" ? "bg-gold text-on-gold" : "";

export default function ScriptWorkspace({ projectId, hasStory, versions, job, stage }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(job?.status === "running");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reviseFor, setReviseFor] = useState<string | null>(null);
  const [reviseText, setReviseText] = useState("");

  // While the screenwriter writes, poll until the job finishes, then reload the page data
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null }>(`/api/film/projects/${projectId}/script`);
        if (s.status !== "running") {
          setRunning(false);
          router.refresh();
        }
      } catch {
        // keep polling; a network blip should not stop it
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [running, projectId, router]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { jobId } = await postJson<{ jobId: string | null }>(`/api/film/projects/${projectId}/script`, body);
      setReviseFor(null);
      setReviseText("");
      if (jobId) setRunning(true);
      router.refresh();
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

  if (versions.length === 0 && !running && !failed) {
    return (
      <div className="card space-y-4 p-6 text-center">
        <p className="text-5xl">✍️</p>
        <p className="font-bold">السيناريست بيقرأ قصتك ويعرض عليك فهمه أول، وما يكمّل إلا لما تكتب «اعتمد».</p>
        {!hasStory && (
          <p className="error-box">
            اكتب قصتك أول في <Link href={`/film/${projectId}`} className="underline">صفحة المشروع</Link>.
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
                <span className={`chip ${chipClass(v.status)}`}>
                  {v.kind === "questions" && v.status === "approved" ? "تمت الإجابة" : STATUS_LABELS[v.status]}
                </span>
              </div>
            </header>

            {/* Questions waiting for answers are shown as a form instead of text */}
            {v.kind === "questions" && isCurrent ? (
              <QuestionsForm version={v} busy={busy || running} onSubmit={(answers) => send({ action: "answers", versionId: v.id, answers })} />
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

            {/* Actions */}
            {isCurrent && v.kind !== "questions" && !running && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button className="btn btn-primary flex-1" disabled={busy} onClick={() => send({ action: "approve", versionId: v.id })}>
                    اعتمد ✅
                  </button>
                  <button className="btn btn-ghost flex-1" disabled={busy} onClick={() => setReviseFor(reviseFor === v.id ? null : v.id)}>
                    اطلب تعديل ✏️
                  </button>
                </div>
              </div>
            )}
            {!isCurrent && v.status === "approved" && !running && v.kind !== "questions" && (
              <button className="text-sm font-bold text-muted underline" onClick={() => setReviseFor(reviseFor === v.id ? null : v.id)}>
                أبي أعدّل شي في {KIND_LABELS[v.kind]}
              </button>
            )}
            {reviseFor === v.id && (
              <div className="space-y-2">
                {!isCurrent && (
                  <p className="text-sm font-bold text-muted">
                    هذا جزء معتمد. بعد التعديل، الأجزاء اللي بعده تنعلّم «قد تكون قديمة»، والسيناريست يوضح وش يتأثر ويحدّثه بموافقتك.
                  </p>
                )}
                <textarea
                  className="field min-h-28"
                  value={reviseText}
                  onChange={(e) => setReviseText(e.target.value.slice(0, 4000))}
                  placeholder="اكتب وش تبي يتغيّر، بكلامك"
                />
                <button
                  className="btn btn-secondary w-full"
                  disabled={busy || !reviseText.trim()}
                  onClick={() => send({ action: "revise", text: reviseText, versionId: v.id })}
                >
                  أرسل التعديل
                </button>
              </div>
            )}
          </article>
        );
      })}

      {running && (
        <div className="card flex items-center gap-3 p-5" role="status">
          <Spinner />
          <div>
            <p className="font-extrabold">{latest("screenplay")?.status === "approved" ? "ننقل السيناريو لصانع الشيت…" : "السيناريست يكتب…"}</p>
            <p className="text-sm font-bold text-muted">ممكن ياخذ من دقيقة إلى ٣ دقائق. تقدر تسكّر الصفحة وترجع، الرد ينحفظ.</p>
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
          <p className="text-sm font-bold text-muted">صانع الشيت ينضاف في المرحلة الجاية من التطوير.</p>
        </div>
      )}

      {!running && <p className="text-center text-xs font-bold text-muted">{COST_HINT}</p>}
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}

function QuestionsForm({ version, busy, onSubmit }: { version: ScriptVersion; busy: boolean; onSubmit: (answers: string[]) => void }) {
  const qs = version.data.questions ?? [];
  const [choice, setChoice] = useState<string[]>(qs.map(() => ""));
  const [other, setOther] = useState<string[]>(qs.map(() => ""));
  const answer = (i: number) => (choice[i] === "__other" ? other[i].trim() : choice[i]);
  const ready = qs.every((_, i) => answer(i));
  const setAt = (arr: string[], i: number, v: string) => arr.map((x, j) => (j === i ? v : x));

  return (
    <div className="space-y-5">
      {qs.map((q, i) => (
        <fieldset key={i} className="space-y-2">
          <legend className="mb-1 font-extrabold">{i + 1}. {q.question}</legend>
          {[...q.options, "__other"].map((opt) => (
            <label key={opt} className={`flex cursor-pointer items-start gap-2 rounded-2xl border p-3 ${choice[i] === opt ? "border-gold bg-surface-2" : "border-line"}`}>
              <input type="radio" className="mt-1.5 accent-[var(--gold)]" name={`q${i}`} checked={choice[i] === opt} onChange={() => setChoice(setAt(choice, i, opt))} />
              <span className="font-bold">{opt === "__other" ? "جواب ثاني من عندي" : opt}</span>
            </label>
          ))}
          {choice[i] === "__other" && (
            <textarea className="field min-h-20" value={other[i]} onChange={(e) => setOther(setAt(other, i, e.target.value.slice(0, 1500)))} placeholder="اكتب جوابك" />
          )}
        </fieldset>
      ))}
      <button className="btn btn-primary w-full" disabled={busy || !ready} onClick={() => onSubmit(qs.map((_, i) => answer(i)))}>
        أرسل إجاباتي
      </button>
    </div>
  );
}

