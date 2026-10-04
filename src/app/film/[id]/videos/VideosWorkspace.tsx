"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import Markdown from "@/components/Markdown";
import Spinner from "@/components/Spinner";
import QuestionsForm from "../../QuestionsForm";
import ActionBar, { EditsLeftContext } from "../../ActionBar";
import { statusChip } from "../../StepCard";
import {
  clampVideoSeconds,
  DEFAULT_VIDEO_RESOLUTION,
  STATUS_LABELS,
  VIDEO_DURATION,
  VIDEO_KEEP_DAYS,
  VIDEO_MODELS,
  VIDEO_OPEN_RESOLUTIONS,
  VIDEO_RESOLUTIONS,
  videoEstimateUsd,
  type VideoModel,
  type VideoResolution,
} from "@config/film";
import { useFilmBase } from "../../FilmBase";

interface Generation {
  /** The director's understanding of the client's video notes, as options to choose from. */
  questions: { id: string; body: string; items: { question: string; options: string[] }[] } | null;
  /** The revised generation written after those answers, waiting for approval. */
  revision: { id: string; body: string } | null;
  id: string;
  name: string;
  model: VideoModel;
  durationSec: number;
  ratio: string;
  audio: boolean;
}
interface Video {
  id: string;
  ref_key: string;
  status: string;
  error: string | null;
  resolution: string;
  ratio: string;
  removed: boolean;
  createdAt: string;
  url: string;
  download: string;
}

const RESOLUTIONS = Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[];
const usd = (n: number) => `$${n.toFixed(2)}`;

/** Days left before a video file is removed from the site. */
const daysLeft = (createdAt: string) => Math.max(0, Math.ceil(VIDEO_KEEP_DAYS - (Date.now() - new Date(createdAt).getTime()) / 86_400_000));

export default function VideosWorkspace({
  projectId, stage, generations, videos, videosRunning, trialVideosLeft, editsLeft, job,
}: {
  projectId: string;
  stage: string;
  generations: Generation[];
  videos: Video[];
  videosRunning: number;
  /** Public trial: whether this user's one free video is made or being made (null: no trial limit). */
  /** Public trial: free videos this user has left (null: no trial limit). */
  trialVideosLeft: number | null;
  /** Edits left with the director, video notes included (null: no limit). */
  editsLeft: number | null;
  job: { status: string; error: string | null } | null;
}) {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [resolution, setResolution] = useState<VideoResolution>(DEFAULT_VIDEO_RESOLUTION);
  // Orientation for every video: the director's choice by default (the most common one in the approved generations)
  const [ratio, setRatio] = useState<"16:9" | "9:16">(() =>
    generations.filter((g) => g.ratio === "9:16").length > generations.length / 2 ? "9:16" : "16:9",
  );
  // Length of each video (4–15 s), starting from the director's plan; the price follows it
  const [seconds, setSeconds] = useState<Record<string, number>>(() => Object.fromEntries(generations.map((g) => [g.id, clampVideoSeconds(g.durationSec)])));
  const secOf = (g: Generation) => seconds[g.id] ?? clampVideoSeconds(g.durationSec);
  // Seedance version for every video: the director's choice by default (the most common one)
  const [model, setModel] = useState<VideoModel>(() =>
    generations.filter((g) => g.model === "seedance-2.0").length > generations.length / 2 ? "seedance-2.0" : "seedance-2.5",
  );
  const [rendering, setRendering] = useState(videosRunning > 0);
  // The director answering the client's notes on a video
  const [writing, setWriting] = useState(job?.status === "running");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Poll while videos are generated (the poll also saves finished videos)
  useEffect(() => {
    if (!rendering && !writing) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null; videosRunning: number }>(`/api/film/projects/${projectId}/director`);
        const w = s.status === "running";
        const r = s.videosRunning > 0;
        if (w !== writing || r !== rendering) router.refresh();
        setWriting(w);
        setRendering(r);
      } catch {
        // keep polling
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [rendering, writing, projectId, router]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { jobId } = await postJson<{ jobId: string | null }>(`/api/film/projects/${projectId}/director`, body);
      if (jobId) setWriting(true);
      if (body.action === "generate_video" || body.action === "approve_and_generate") setRendering(true);
      if (body.action === "video_feedback") {
        setFeedbackFor(null);
        setFeedback("");
      }
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kept = videos.filter((v) => v.url && v.status !== "rejected");

  return (
    <EditsLeftContext value={editsLeft}>
    <div className="space-y-4">
      {trialVideosLeft !== null && (
        <p className="card p-4 text-center font-extrabold">
          🎁 {trialVideosLeft === 0 ? "خلصت فيديوهات تجربتك المجانية. حمّلها وشكرًا لك!" : `باقي لك ${trialVideosLeft} فيديو مجاني في التجربة؛ بعد آخر واحد تنتهي التجربة. اختر جودته ومدته على راحتك.`}
        </p>
      )}
      <section className="space-y-1 rounded-2xl border-2 border-red-500 bg-red-500/10 p-4">
        <p className="font-extrabold text-red-500">⬇️ حمّل فيديوهاتك</p>
        <p className="text-sm font-bold">
          كل فيديو يبقى في الموقع {VIDEO_KEEP_DAYS} أيام من يوم توليده، وبعدها ينحذف نهائيًا. حمّل كل فيديو تبيه على جهازك من زر «حمّل» تحته.
        </p>
      </section>

      {/* The last decisions before generating: orientation, then quality (each has its price) */}
      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">اتجاه الفيديو</h2>
        <div className="grid grid-cols-2 gap-2">
          {([["16:9", "🖥️ عرضي", "للشاشات واليوتيوب"], ["9:16", "📱 طولي", "للجوال والريلز"]] as const).map(([r, label, hint]) => (
            <button
              key={r}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-start ${ratio === r ? "border-gold bg-gold/10" : "border-line"}`}
              onClick={() => setRatio(r)}
              aria-pressed={ratio === r}
            >
              <span className={`shrink-0 rounded-md border-2 border-current ${r === "16:9" ? "h-6 w-10" : "h-10 w-6"}`} aria-hidden />
              <span>
                <span className="block font-extrabold">{label} <span dir="ltr">{r}</span></span>
                <span className="block text-xs font-bold text-muted">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        {generations.some((g) => g.ratio !== ratio) && (
          <p className="text-xs font-bold text-muted">⚠️ المخرج خطّط بعض التوليدات على اتجاه ثاني؛ تغييره ممكن يغيّر التأطير. لو تبي إخراج مبني على هذا الاتجاه، اطلبه من المخرج.</p>
        )}
      </section>


      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">نسخة Seedance</h2>
        <div className="grid grid-cols-2 gap-2">
          {([["seedance-2.5", "الأحدث، والمخرج يفضّلها"], ["seedance-2.0", "أرخص"]] as const).map(([m, hint]) => (
            <button
              key={m}
              className={`rounded-2xl border-2 p-3 text-start ${model === m ? "border-gold bg-gold/10" : "border-line"}`}
              onClick={() => setModel(m)}
              aria-pressed={model === m}
            >
              <span className="block font-extrabold" dir="ltr">{VIDEO_MODELS[m].label}</span>
              <span className="block text-xs font-bold text-muted">{hint}</span>
            </button>
          ))}
        </div>
        {generations.some((g) => g.model !== model) && (
          <p className="text-xs font-bold text-muted">⚠️ المخرج كتب بعض البرومبتات لنسخة ثانية؛ تقدر تكمل، بس النتيجة ممكن تختلف شوي.</p>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="text-lg font-extrabold">جودة الفيديو</h2>
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              className={`rounded-2xl border-2 p-3 text-start ${resolution === r ? "border-gold bg-gold/10" : "border-line"} disabled:opacity-50`}
              onClick={() => setResolution(r)}
              disabled={!VIDEO_OPEN_RESOLUTIONS.includes(r)}
              aria-pressed={resolution === r}
            >
              <span className="block font-extrabold" dir="ltr">{VIDEO_RESOLUTIONS[r].label}</span>
              <span className="block text-xs font-bold text-muted">{VIDEO_OPEN_RESOLUTIONS.includes(r) ? VIDEO_RESOLUTIONS[r].hint : "🔒 مقفلة حاليًا"}</span>
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-muted">السعر التقريبي يطلع عند شريط المدة تحت كل توليد، والتكلفة الحقيقية تنحسب بعد التوليد. الفيديو اللي يفشل ما ينحسب.</p>
      </section>

      {generations.map((g) => {
        const mine = videos.filter((v) => v.ref_key === g.id && v.status !== "rejected");
        const generating = mine.some((v) => v.status === "generating");
        const sec = secOf(g);
        const cost = videoEstimateUsd(model, resolution, sec);
        return (
          <article key={g.id} className="card space-y-3 p-5">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold">{g.id}{g.name ? ` · ${g.name}` : ""}</h2>
              <div className="flex flex-wrap gap-1 text-xs font-bold">
                <span className="chip" dir="ltr">{ratio}</span>
                <span className="chip">{g.audio ? "🔊 بصوت" : "🔇 بدون صوت"}</span>
              </div>
            </header>

            {mine.map((v) => (
              <figure key={v.id} className={`space-y-2 rounded-2xl border p-2 ${v.status === "approved" ? "border-2 border-teal" : "border-line"}`}>
                {v.status === "generating" ? (
                  <div className="grid aspect-video place-items-center rounded-xl bg-surface-2"><Spinner /><p className="text-sm font-bold">نولّد الفيديو… (من دقيقتين إلى ١٠ دقائق، تقدر تسكّر الصفحة)</p></div>
                ) : v.status === "failed" ? (
                  <p className="error-box">فشل التوليد: {v.error}. ما انحسبت تكلفة.</p>
                ) : v.removed ? (
                  <p className="rounded-xl bg-surface-2 p-4 text-sm font-bold text-muted">انحذف هذا الفيديو من الموقع بعد {VIDEO_KEEP_DAYS} أيام.</p>
                ) : (
                  <video src={v.url} controls playsInline className="w-full rounded-xl" aria-label={g.id} />
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`chip ${statusChip(v.status)}`}>
                    {STATUS_LABELS[v.status] ?? v.status}
                    {v.resolution ? ` · ${v.resolution}` : ""}
                    {v.ratio ? ` · ${v.ratio === "9:16" ? "طولي" : "عرضي"}` : ""}
                    {v.url && !v.removed ? ` · يبقى ${daysLeft(v.createdAt)} يوم` : ""}
                  </span>
                  {!busy && (
                    <div className="flex flex-wrap gap-2">
                      {v.download && !v.removed && (
                        <a className="btn btn-secondary min-h-10 px-4 text-sm" href={v.download}>⬇️ حمّل</a>
                      )}
                      {v.status === "generated" && !v.removed && (
                        <>
                          <button className="btn btn-primary min-h-10 px-4 text-sm" onClick={() => send({ action: "approve_video", assetId: v.id })}>اعتمد ✅</button>
                          {!writing && editsLeft !== 0 && (
                            <button className="btn btn-secondary min-h-10 px-4 text-sm" onClick={() => setFeedbackFor(feedbackFor === v.id ? null : v.id)}>
                              ✏️ اطلب تعديل{editsLeft !== null ? ` (باقي ${editsLeft})` : ""}
                            </button>
                          )}
                          <button className="btn btn-ghost min-h-10 px-4 text-sm" onClick={() => send({ action: "reject_video", assetId: v.id })}>ارفضه</button>
                        </>
                      )}
                      {v.status === "approved" && (
                        <button
                          className="btn btn-ghost min-h-10 px-4 text-sm"
                          onClick={() => window.confirm("تبي تتراجع عن اعتماد هذا الفيديو؟ بعدها تقدر تولّد نسخة ثانية.") && send({ action: "unapprove_video", assetId: v.id })}
                        >
                          ↩️ تراجع عن الاعتماد
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {feedbackFor === v.id && !busy && (
                  <div className="space-y-2">
                    <textarea
                      className="field min-h-24"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value.slice(0, 4000))}
                      placeholder="وش تبي يتغيّر في هذا الفيديو؟ اكتب بكلامك، والمخرج يرد عليك بفهمه وخيارات قبل ما يعدّل."
                    />
                    <button className="btn btn-secondary w-full" disabled={!feedback.trim()} onClick={() => send({ action: "video_feedback", assetId: v.id, text: feedback })}>
                      أرسل التعديلات للمخرج
                    </button>
                  </div>
                )}
              </figure>
            ))}

            {/* Notes on a video → the director's understanding as options → the revised generation → a new video */}
            {g.questions && (
              <div className="space-y-3 rounded-2xl border-2 border-gold p-4">
                <p className="font-extrabold">🎬 فهم المخرج لتعديلاتك</p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-extrabold text-muted">اعرض رسالة المخرج كاملة</summary>
                  <Markdown text={g.questions.body} hideCode />
                </details>
                <QuestionsForm questions={g.questions.items} busy={busy || writing} onSubmit={(answers) => send({ action: "answers", versionId: g.questions!.id, answers })} />
              </div>
            )}
            {g.revision && (
              <div className="space-y-3 rounded-2xl border-2 border-gold p-4">
                <p className="font-extrabold">✅ التعديل جاهز</p>
                <details className="text-sm">
                  <summary className="cursor-pointer font-extrabold text-muted">اعرض تحليل المخرج للنسخة المعدّلة</summary>
                  <Markdown text={g.revision.body} hideCode />
                </details>
                <ActionBar
                  busy={busy || writing}
                  onApprove={() => send({ action: "approve_and_generate", versionId: g.revision!.id, resolution, ratio, durationSec: sec, model })}
                  approveLabel={`اعتمد وولّد من جديد · ≈ ${usd(cost)}`}
                  onSend={(mode, text) => send({ action: "revise", text, versionId: g.revision!.id, mode })}
                />
              </div>
            )}

            {!generating && !busy && (
              <div className="space-y-1 rounded-2xl bg-surface-2 p-3">
                <div className="flex items-center justify-between text-sm font-extrabold">
                  <label htmlFor={`sec-${g.id}`}>مدة الفيديو: <span dir="ltr">{sec}s</span></label>
                  <span dir="ltr">≈ {usd(cost)}</span>
                </div>
                <input
                  id={`sec-${g.id}`}
                  type="range"
                  min={VIDEO_DURATION.min}
                  max={VIDEO_DURATION.max}
                  step={1}
                  value={sec}
                  onChange={(e) => setSeconds({ ...seconds, [g.id]: Number(e.target.value) })}
                  className="w-full accent-gold"
                  dir="ltr"
                />
                <div className="flex justify-between text-xs font-bold text-muted" dir="ltr">
                  <span>{VIDEO_DURATION.min}s</span>
                  {clampVideoSeconds(g.durationSec) !== sec && <span>المخرج خطّط {clampVideoSeconds(g.durationSec)}s</span>}
                  <span>{VIDEO_DURATION.max}s</span>
                </div>
                {sec < clampVideoSeconds(g.durationSec) && (
                  <p className="text-xs font-bold text-red-500">⚠️ أقصر من خطة المخرج؛ ممكن الحوار أو الأحداث ما تلحق تكتمل.</p>
                )}
              </div>
            )}
            {!generating && !busy && !g.questions && !g.revision && (
              <button
                className={`btn w-full ${mine.length ? "btn-ghost" : "btn-primary"}`}
                onClick={() => send({ action: "generate_video", genId: g.id, resolution, ratio, durationSec: sec, model })}
              >
                {mine.length ? "🔁 ولّد نسخة ثانية" : "🎬 ولّد الفيديو"} · {ratio === "9:16" ? "طولي" : "عرضي"} · {VIDEO_MODELS[model].label} · {VIDEO_RESOLUTIONS[resolution].label}
              </button>
            )}
          </article>
        );
      })}

      {writing && (
        <div className="card flex items-center gap-3 p-5" role="status">
          <Spinner />
          <div>
            <p className="font-extrabold">المخرج يقرأ تعديلاتك ويكتب…</p>
            <p className="text-sm font-bold text-muted">من دقيقة إلى ٣ دقائق. تقدر تسكّر الصفحة وترجع.</p>
          </div>
        </div>
      )}
      {job?.status === "failed" && !writing && (
        <div className="card space-y-3 p-5">
          <p className="error-box">ما كمل رد المخرج: {job.error}. ما انحسبت عليك تكلفة.</p>
          <button className="btn btn-primary w-full" disabled={busy} onClick={() => send({ action: "retry" })}>أعد المحاولة</button>
        </div>
      )}
      {kept.length > 0 && (
        <p className="text-center text-sm font-bold text-muted">تقدر بعد تطلب تعديل أكبر من صفحة <Link href={`${filmBase}/${projectId}/director`} className="underline">المخرج</Link>.</p>
      )}
      {stage === "voices" || stage === "done" ? (
        <div className="card space-y-1 p-5 text-center">
          <p className="text-lg font-extrabold">✅ كل الفيديوهات معتمدة</p>
          <p className="text-sm font-bold text-muted">الأصوات تنضاف في المرحلة الجاية من التطوير. لا تنسى تحمّل فيديوهاتك.</p>
        </div>
      ) : null}
      {error && <p className="error-box">{error}</p>}
    </div>
    </EditsLeftContext>
  );
}
