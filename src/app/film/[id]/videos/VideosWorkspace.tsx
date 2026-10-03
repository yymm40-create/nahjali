"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, postJson } from "@/lib/fetch";
import Spinner from "@/components/Spinner";
import { statusChip } from "../../StepCard";
import {
  DEFAULT_VIDEO_RESOLUTION,
  STATUS_LABELS,
  VIDEO_KEEP_DAYS,
  VIDEO_MODELS,
  VIDEO_RESOLUTIONS,
  videoEstimateUsd,
  type VideoModel,
  type VideoResolution,
} from "@config/film";

interface Generation {
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
  projectId, stage, generations, videos, videosRunning,
}: {
  projectId: string;
  stage: string;
  generations: Generation[];
  videos: Video[];
  videosRunning: number;
}) {
  const router = useRouter();
  const [resolution, setResolution] = useState<VideoResolution>(DEFAULT_VIDEO_RESOLUTION);
  // Orientation for every video: the director's choice by default (the most common one in the approved generations)
  const [ratio, setRatio] = useState<"16:9" | "9:16">(() =>
    generations.filter((g) => g.ratio === "9:16").length > generations.length / 2 ? "9:16" : "16:9",
  );
  const [rendering, setRendering] = useState(videosRunning > 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Poll while videos are generated (the poll also saves finished videos)
  useEffect(() => {
    if (!rendering) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ videosRunning: number }>(`/api/film/projects/${projectId}/director`);
        if (s.videosRunning === 0) {
          setRendering(false);
          router.refresh();
        }
      } catch {
        // keep polling
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [rendering, projectId, router]);

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/film/projects/${projectId}/director`, body);
      if (body.action === "generate_video") setRendering(true);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const total = generations.reduce((s, g) => s + videoEstimateUsd(g.model, resolution, g.durationSec), 0);
  const kept = videos.filter((v) => v.url && v.status !== "rejected");

  return (
    <div className="space-y-4">
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
        <h2 className="text-lg font-extrabold">جودة الفيديو</h2>
        <div className="grid grid-cols-3 gap-2">
          {RESOLUTIONS.map((r) => (
            <button
              key={r}
              className={`rounded-2xl border-2 p-3 text-start ${resolution === r ? "border-gold bg-gold/10" : "border-line"}`}
              onClick={() => setResolution(r)}
              aria-pressed={resolution === r}
            >
              <span className="block font-extrabold" dir="ltr">{VIDEO_RESOLUTIONS[r].label}</span>
              <span className="block text-xs font-bold text-muted">{VIDEO_RESOLUTIONS[r].hint}</span>
              <span className="mt-1 block text-sm font-extrabold" dir="ltr">
                ≈ {usd(videoEstimateUsd("seedance-2.5", r, 10))} / 10s
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs font-bold text-muted">
          الأسعار تقريبية (Seedance 2.5، ونسخة 2.0 أرخص). كل التوليدات بهذي الجودة تقريبًا <span dir="ltr">{usd(total)}</span>. الفيديو اللي يفشل ما ينحسب.
        </p>
      </section>

      {generations.map((g) => {
        const mine = videos.filter((v) => v.ref_key === g.id && v.status !== "rejected");
        const generating = mine.some((v) => v.status === "generating");
        const cost = videoEstimateUsd(g.model, resolution, g.durationSec);
        return (
          <article key={g.id} className="card space-y-3 p-5">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold">{g.id}{g.name ? ` · ${g.name}` : ""}</h2>
              <div className="flex flex-wrap gap-1 text-xs font-bold">
                <span className="chip">{VIDEO_MODELS[g.model].label}</span>
                <span className="chip" dir="ltr">{g.durationSec}s · {ratio}</span>
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
              </figure>
            ))}

            {!generating && !busy && (
              <button
                className={`btn w-full ${mine.length ? "btn-ghost" : "btn-primary"}`}
                onClick={() => send({ action: "generate_video", genId: g.id, resolution, ratio })}
              >
                {mine.length ? "🔁 ولّد نسخة ثانية" : "🎬 ولّد الفيديو"} · {ratio === "9:16" ? "طولي" : "عرضي"} · {VIDEO_RESOLUTIONS[resolution].label} · تقريبًا <span dir="ltr">{usd(cost)}</span>
              </button>
            )}
          </article>
        );
      })}

      {kept.length > 0 && (
        <p className="text-center text-sm font-bold text-muted">تبي تعدّل توليد؟ ارجع لـ <Link href={`/film/${projectId}/director`} className="underline">المخرج</Link> واطلب التعديل، وبعد ما تعتمده ولّده هنا من جديد.</p>
      )}
      {stage === "voices" || stage === "done" ? (
        <div className="card space-y-1 p-5 text-center">
          <p className="text-lg font-extrabold">✅ كل الفيديوهات معتمدة</p>
          <p className="text-sm font-bold text-muted">الأصوات تنضاف في المرحلة الجاية من التطوير. لا تنسى تحمّل فيديوهاتك.</p>
        </div>
      ) : null}
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}
