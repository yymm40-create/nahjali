"use client";

import VoiceDesigner from "../../VoiceDesigner";
import { credits } from "@/lib/film/credits";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
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
import EmotionPicker from "../../EmotionPicker";
import RewindCard from "../RewindCard";
import { smartEditInEditor } from "@/components/jawad/editor/smart-open";

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
  /** reference pictures the director attached */
  refs: number;
  /** This shot's spoken lines and whether each one's audio is made («الأصوات قبل الفيديو»). */
  lines: { key: string; speaker: string; line: string; spoken: boolean }[];
}
/** The voices page's state, loaded once here for the per-shot voice blocks. */
interface VoiceState {
  ready: boolean;
  cast: Record<string, string>;
  audios: { key: string; url: string; text: string }[];
  voices: { value: string; name: string; group: "mine" | "ready" | "minimax"; provider?: "elevenlabs" | "minimax" | "jawad" }[];
  /** «الحوار من جهازي»: the person's own recording per shot */
  tracks?: { genId: string; url: string | null; name: string; seconds: number }[];
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
  /** «ملاحظة للمونتاج» on this take */
  note: string;
  /** the person's own edited version, uploaded */
  edited: boolean;
}

const RESOLUTIONS = Object.keys(VIDEO_RESOLUTIONS) as VideoResolution[];
/** Videos made at the same time (the server's MAX_VIDEOS_AT_ONCE). */
const MAX_AT_ONCE = 10;
const usd = (n: number) => credits(n);

/** Days left before a video file is removed from the site. */
const daysLeft = (createdAt: string) => Math.max(0, Math.ceil(VIDEO_KEEP_DAYS - (Date.now() - new Date(createdAt).getTime()) / 86_400_000));

interface StudioVideo {
  jobId: string;
  url: string;
  seconds: number | null;
  generator: string;
  prompt: string;
  from: string;
  at: string;
}

export default function VideosWorkspace({
  projectId, stage, generations, videos, videosRunning, trialVideosLeft, editsLeft, job, studioPath = null, voicesOn = false, dialogueStart, dialogueSource = null,
}: {
  /** ElevenLabs is configured on the server: the voices block is shown. */
  voicesOn?: boolean;
  /** The dialogue mode every shot starts on: the person's «مصدر الحوار» answer to the screenwriter. */
  dialogueStart?: "make" | "upload" | "none";
  dialogueSource?: "make" | "upload" | "self" | "later" | null;
  /** JAWAD AI's video section (when this user may use it): «التعديل الذكي» there, and its videos can be chosen here */
  studioPath?: string | null;
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
  // «اكتب الكلام العربي في البرومبت»: on = the lines are written in the prompt too; off = from the voices only
  const [arabicInPrompt, setArabicInPrompt] = useState(true);
  // Orientation for every video: the director's choice by default (the most common one in the approved generations)
  const [ratio, setRatio] = useState<"16:9" | "9:16">(() =>
    generations.filter((g) => g.ratio === "9:16").length > generations.length / 2 ? "9:16" : "16:9",
  );
  // Length of each video (4–15 s), starting from the director's plan; the price follows it
  const [seconds, setSeconds] = useState<Record<string, number>>(() => Object.fromEntries(generations.map((g) => [g.id, clampVideoSeconds(g.durationSec)])));
  // (within the chosen Seedance's own limit: 30 s on 2.5, 15 s on 2.0)
  const secOf = (g: Generation) => clampVideoSeconds(seconds[g.id] ?? g.durationSec, model);
  // Seedance version for every video: the director's choice by default (the most common one)
  const [model, setModel] = useState<VideoModel>(() =>
    generations.filter((g) => g.model === "seedance-2.0").length > generations.length / 2 ? "seedance-2.0" : "seedance-2.5",
  );
  const [rendering, setRendering] = useState(videosRunning > 0);
  // The director answering the client's notes on a video
  const [writing, setWriting] = useState(job?.status === "running");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [sending, setBusy] = useState(false);
  // Busy until the new page data has arrived: the old screen's buttons can't be pressed a second time
  const [refreshing, startRefresh] = useTransition();
  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);
  const busy = sending || refreshing;
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Poll while videos are generated (the poll also saves finished videos)
  useEffect(() => {
    if (!rendering && !writing) return;
    const timer = setInterval(async () => {
      try {
        const s = await api<{ status: string | null; videosRunning: number }>(`/api/film/projects/${projectId}/director`);
        const w = s.status === "running";
        const r = s.videosRunning > 0;
        if (w !== writing || r !== rendering) refresh();
        setWriting(w);
        setRendering(r);
      } catch {
        // keep polling
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [rendering, writing, projectId, router, refresh]);

  // The video section: its finished videos, to choose one for a generation
  const [pickFor, setPickFor] = useState<string | null>(null);
  const [studio, setStudio] = useState<StudioVideo[] | null>(null);
  async function openPicker(genId: string) {
    setPickFor(pickFor === genId ? null : genId);
    if (studio === null) {
      try {
        const r = await fetch(`/api/film/projects/${projectId}/studio`, { cache: "no-store" });
        const j = await r.json();
        setStudio(r.ok ? (j.videos as StudioVideo[]) : []);
      } catch {
        setStudio([]);
      }
    }
  }

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const { jobId, studioJobId, warning } = await postJson<{ jobId: string | null; studioJobId?: string; warning?: string }>(`/api/film/projects/${projectId}/director`, body);
      if (warning) setNotice(warning);
      if (studioJobId && studioPath) {
        // «التعديل الذكي» in «حيدرة كت» (red/green tracks); else the video section with its own window ready
        const href = await smartEditInEditor(studioJobId);
        router.push(href ?? `${studioPath}?edit=${studioJobId}`);
        return;
      }
      if (body.action === "use_studio_video") setPickFor(null);
      if (jobId) setWriting(true);
      if (body.action === "generate_video" || body.action === "approve_and_generate") setRendering(true);
      if (body.action === "video_feedback") {
        setFeedbackFor(null);
        setFeedback("");
      }
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const kept = videos.filter((v) => v.url && v.status !== "rejected");

  // ── «الأصوات قبل الفيديو»: the lines of each shot are spoken here, then ride along as reference audio ──
  const voicesUrl = `/api/film/projects/${projectId}/voices`;
  const [voice, setVoice] = useState<VoiceState | null>(null);
  const [speaking, setSpeaking] = useState<string | null>(null);
  // the feeling of each line, sent between [ ] when it is spoken
  const [feel, setFeel] = useState<Record<string, string>>({});
  const [voiceError, setVoiceError] = useState("");
  const hasLines = generations.some((g) => g.lines.length);
  useEffect(() => {
    if (!hasLines) return;
    api<VoiceState>(voicesUrl).then(setVoice).catch((e: Error) => setVoiceError(e.message));
  }, [hasLines, voicesUrl]);
  // Per shot, the dialogue: made here (voices given to its speakers), the person's own recording from their device
  // («من جهازي»: e.g. made in their own ElevenLabs account), or none
  type Dialogue = "make" | "upload" | "none";
  const [dialog, setDialog] = useState<Record<string, Dialogue>>({});
  const modeOf = (g: Generation): Dialogue => dialog[g.id] ?? dialogueStart ?? (voicesOn ? "make" : "none");
  const trackOf = (g: Generation) => voice?.tracks?.find((t) => t.genId === g.id) ?? null;
  const sendVoices = (g: Generation) => g.lines.length > 0 && modeOf(g) !== "none";
  const [trackBusy, setTrackBusy] = useState<string | null>(null);
  async function uploadTrack(g: Generation, file: File) {
    setVoiceError("");
    setTrackBusy(g.id);
    try {
      const mime = file.type || (file.name.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/mpeg");
      const { upload } = await postJson<{ upload: { path: string; token: string } }>(`/api/film/projects/${projectId}/director`, { action: "upload_voice_url", genId: g.id, mime });
      const put = await fetch(upload.token, { method: "PUT", headers: { "content-type": mime }, body: file }).catch(() => null);
      if (!put?.ok) throw new Error("تعذّر رفع الملف؛ تأكد من الإنترنت وجرّب.");
      await postJson(`/api/film/projects/${projectId}/director`, { action: "upload_voice_confirm", genId: g.id, path: upload.path });
      setVoice(await api<VoiceState>(voicesUrl));
    } catch (e) {
      setVoiceError((e as Error).message);
    } finally {
      setTrackBusy(null);
    }
  }
  async function removeTrack(g: Generation) {
    setTrackBusy(g.id);
    try {
      await postJson(`/api/film/projects/${projectId}/director`, { action: "remove_voice_upload", genId: g.id });
      setVoice(await api<VoiceState>(voicesUrl));
    } catch (e) {
      setVoiceError((e as Error).message);
    } finally {
      setTrackBusy(null);
    }
  }
  const spokenOf = (g: Generation, key: string) => {
    const a = voice?.audios.find((x) => x.key === key);
    const l = g.lines.find((x) => x.key === key);
    return Boolean(a && l && a.text === l.line) || Boolean(!voice && l?.spoken);
  };
  const allSpoken = (g: Generation) => g.lines.every((l) => spokenOf(g, l.key));
  /** the shot's dialogue is ready to ride with the video: all its lines spoken, or the person's own file there */
  const dialogueReady = (g: Generation) => (modeOf(g) === "upload" ? Boolean(trackOf(g)) : allSpoken(g));
  const voiceChoice = (g: Generation) => ({ useVoices: sendVoices(g) && dialogueReady(g), voiceSource: modeOf(g) === "upload" ? ("upload" as const) : ("make" as const), arabicInPrompt });
  async function castVoice(speaker: string, value: string) {
    setVoiceError("");
    setVoice((x) => (x ? { ...x, cast: { ...x.cast, [speaker]: value } } : x));
    try {
      await postJson(voicesUrl, { action: "cast", speaker, voice: value });
    } catch (e) {
      setVoiceError((e as Error).message);
    }
  }
  async function speakLines(keys: string[]) {
    setVoiceError("");
    for (const key of keys) {
      setSpeaking(key);
      try {
        await postJson(voicesUrl, { action: "speak", key, idempotencyKey: crypto.randomUUID(), emotion: feel[key] ?? "" });
        setVoice(await api<VoiceState>(voicesUrl));
      } catch (e) {
        setVoiceError((e as Error).message);
        break;
      }
    }
    setSpeaking(null);
    refresh();
  }

  /**
   * One video: its spoken lines are made first when it has some (a voice is given to any speaker still without one,
   * the voices differing between speakers), then the video is sent with them as reference audio.
   */
  async function generate(g: Generation) {
    let useVoices = false;
    if (sendVoices(g) && modeOf(g) === "upload") {
      if (!trackOf(g)) {
        setVoiceError(`ارفع ملف حوار ${g.id} من جهازك أول (MP3 أو WAV)، أو اختر «أصنعه هنا».`);
        return;
      }
      useVoices = true;
    } else if (sendVoices(g) && voice) {
      const cast = { ...voice.cast };
      const free = voice.voices.filter((v) => v.group === "ready" && !Object.values(cast).includes(v.value));
      for (const sp of [...new Set(g.lines.map((l) => l.speaker))]) {
        if (cast[sp]) continue;
        const pick = free.shift();
        if (!pick) break;
        cast[sp] = pick.value;
        await castVoice(sp, pick.value);
      }
      const missing = g.lines.filter((l) => !spokenOf(g, l.key)).map((l) => l.key);
      if (missing.length) await speakLines(missing);
      useVoices = true;
    }
    const sec = secOf(g);
    await send({ action: "generate_video", genId: g.id, resolution, ratio, durationSec: sec, model, useVoices, voiceSource: voiceChoice(g).voiceSource, arabicInPrompt });
  }
  const runningNow = videos.filter((v) => v.status === "generating").length;
  const notStarted = generations.filter((g) => !videos.some((v) => v.ref_key === g.id && v.status !== "rejected" && v.status !== "failed") && !g.questions && !g.revision);
  const [startingAll, setStartingAll] = useState(false);
  async function startAll() {
    setStartingAll(true);
    try {
      for (const g of notStarted.slice(0, Math.max(0, MAX_AT_ONCE - runningNow))) await generate(g);
    } finally {
      setStartingAll(false);
    }
  }

  // «ارفع الفيديو المعدّل»: the person's own finished edit of a generation (e.g. after «التعديل الذكي»)
  const [uploading, setUploading] = useState<string | null>(null);
  async function uploadEdited(g: Generation, file: File) {
    setError("");
    setUploading(g.id);
    try {
      const mime = file.type || (file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : "video/mp4");
      const { upload } = await postJson<{ upload: { path: string; token: string } }>(`/api/film/projects/${projectId}/director`, { action: "upload_video_url", genId: g.id, mime });
      const put = await fetch(upload.token, { method: "PUT", headers: { "content-type": mime }, body: file }).catch(() => null);
      if (!put?.ok) throw new Error("تعذّر رفع الفيديو؛ تأكد من الإنترنت وجرّب.");
      await postJson(`/api/film/projects/${projectId}/director`, { action: "upload_video_confirm", genId: g.id, path: upload.path });
      setNotice(`✅ اعتمدنا فيديوك المعدّل لـ ${g.id}`);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(null);
    }
  }

  // one take: the video, its actions, its montage note, its notes to the director
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const saveNote = (v: Video) => {
    const text = noteDraft[v.id];
    if (text === undefined || text === v.note) return;
    void postJson(`/api/film/projects/${projectId}/director`, { action: "montage_note", assetId: v.id, text }).then(() => refresh()).catch((e: Error) => setError(e.message));
  };
  const renderTake = (v: Video, g: Generation, small = false) => (
              <figure key={v.id} className={`space-y-2 rounded-2xl border p-2 ${small && v.status === "rejected" ? "opacity-60" : ""} ${v.status === "approved" ? "border-2 border-teal" : "border-line"}`}>
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
                      {studioPath && v.url && !v.removed && ["generated", "approved"].includes(v.status) && (
                        <button className="btn btn-secondary min-h-10 px-4 text-sm" onClick={() => send({ action: "send_to_studio", assetId: v.id })}>
                          🪄 التعديل الذكي
                        </button>
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
                {/* «ملاحظة للمونتاج»: what to cut or fix in this take at the montage (not a new generation) */}
                {v.url && !v.removed && ["generated", "approved"].includes(v.status) && (
                  <label className="block space-y-1">
                    <span className="text-xs font-extrabold text-muted">📝 ملاحظة للمونتاج: وش ما عجبك ومن وين لوين؟ (فاضية = عاجبتك)</span>
                    <textarea className="field min-h-14 text-sm" maxLength={1000} value={noteDraft[v.id] ?? v.note} placeholder="مثلًا: من ثانية ٣ لـ٥ اليد تتشوّه، احذفها" onChange={(e) => setNoteDraft({ ...noteDraft, [v.id]: e.target.value })} onBlur={() => saveNote(v)} />
                  </label>
                )}
                {v.edited && <p className="text-xs font-bold text-teal">📤 نسختك المعدّلة</p>}
              </figure>
  );

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
        {generations.some((g) => g.lines.length > 0) && (
          <div className="space-y-1.5 rounded-2xl bg-surface-2 p-3">
            <p className="text-sm font-extrabold">الحوار العربي في البرومبت؟</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={arabicInPrompt} className={`btn min-h-10 px-2 text-xs ${arabicInPrompt ? "btn-secondary" : "btn-ghost"}`} onClick={() => setArabicInPrompt(true)}>✍️ نكتبه بالعربي المشكول + الصوت مرجع</button>
              <button type="button" aria-pressed={!arabicInPrompt} className={`btn min-h-10 px-2 text-xs ${!arabicInPrompt ? "btn-secondary" : "btn-ghost"}`} onClick={() => setArabicInPrompt(false)}>🎙️ من الصوت فقط (ما نكتبه)</button>
            </div>
            <p className="text-xs font-bold text-muted">جرّب الجهتين: الكلام مكتوب في البرومبت يساعد النموذج يفهم مين يتكلم، وبدونه يعتمد على ملف الصوت المرفق بس. ما ينكتب شي على الشاشة في الحالتين.</p>
          </div>
        )}
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

      {notStarted.length > 1 && (
        <section className="card flex flex-wrap items-center justify-between gap-2 p-4">
          <p className="font-extrabold">🎬 {notStarted.length} توليدات ما بدأت · يتولد {MAX_AT_ONCE} في نفس الوقت</p>
          <button className="btn btn-primary min-h-11 px-5" disabled={busy || startingAll || runningNow >= MAX_AT_ONCE} onClick={() => void startAll()}>
            {startingAll ? "نبدأ…" : `▶️ ابدأ ${Math.min(notStarted.length, Math.max(0, MAX_AT_ONCE - runningNow))} مع بعض`}
          </button>
        </section>
      )}
      {notice && <p className="card p-3 text-sm font-bold">{notice}</p>}

      {generations.length > 1 && <p className="text-sm font-bold text-muted">اسحب يمين ويسار بين اللقطات 👈👉</p>}
      <div className="-mx-4 flex snap-x snap-mandatory items-start gap-3 overflow-x-auto px-4 pb-3">
      {generations.map((g) => {
        const mine = videos.filter((v) => v.ref_key === g.id && v.status !== "rejected");
        // the take shown: the approved one, else the newest; every other attempt (rejected too) folded under it
        const main = mine.find((v) => v.status === "approved") ?? mine.at(-1);
        const attempts = videos.filter((v) => v.ref_key === g.id && v.id !== main?.id).reverse();
        const generating = mine.some((v) => v.status === "generating");
        const sec = secOf(g);
        const cost = videoEstimateUsd(model, resolution, sec);
        return (
          <article key={g.id} className="card w-[90%] max-w-[560px] shrink-0 snap-center space-y-3 p-4">
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-extrabold">{g.id}{g.name ? ` · ${g.name}` : ""}</h2>
              <div className="flex flex-wrap gap-1 text-xs font-bold">
                <span className="chip" dir="ltr">{ratio}</span>
                <span className="chip">{g.audio ? "🔊 بصوت" : "🔇 بدون صوت"}</span>
              </div>
            </header>
            {g.refs > VIDEO_MODELS[model].maxImages && (
              <p className="rounded-2xl border-2 border-gold bg-gold/10 p-3 text-sm font-bold">⚠️ المراجع ممتلئة: هذا التوليد فيه {g.refs} صور مرجعية و{VIDEO_MODELS[model].label} يقبل {VIDEO_MODELS[model].maxImages} بس؛ الزايد ما ينرسل. اطلب من المخرج يقلّلها، أو اختر نسخة تقبل أكثر.</p>
            )}

            {main && renderTake(main, g)}
            {attempts.length > 0 && (
              <details className="rounded-2xl border border-line p-2 text-sm">
                <summary className="cursor-pointer font-extrabold text-muted">المحاولات الثانية ({attempts.length})</summary>
                <div className="mt-2 space-y-2">{attempts.map((v) => renderTake(v, g, true))}</div>
              </details>
            )}

            {/* A video made in the video section (or edited there with «التعديل الذكي») can be this generation's video */}
            {studioPath && (
              <div className="space-y-2">
                <button className="btn btn-ghost min-h-10 w-full text-sm" onClick={() => openPicker(g.id)} disabled={busy}>
                  🎞️ {pickFor === g.id ? "إخفاء" : "اختر فيديو من قسم الفيديو لهذا التوليد"}
                </button>
                {pickFor === g.id && (
                  <div className="space-y-2 rounded-2xl border border-line p-2">
                    {studio === null ? (
                      <div className="grid place-items-center p-4"><Spinner /></div>
                    ) : studio.length === 0 ? (
                      <p className="p-3 text-center text-sm font-bold text-muted">
                        ما عندك فيديوهات في قسم الفيديو بعد. <a className="underline" href={studioPath}>اصنع واحدًا هناك</a> ثم ارجع واختره.
                      </p>
                    ) : (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {studio.map((s) => (
                          <li key={s.jobId} className="space-y-1 rounded-xl bg-surface-2 p-2">
                            {s.url && <video src={`${s.url}#t=0.1`} controls preload="metadata" playsInline className="aspect-video w-full rounded-lg bg-black object-contain" />}
                            <p className="text-xs font-bold text-muted">
                              {s.generator}
                              {s.seconds ? ` · ${s.seconds} ث` : ""}
                              {s.from ? ` · ${s.from}` : ""}
                            </p>
                            <button className="btn btn-primary min-h-10 w-full text-sm" disabled={busy} onClick={() => send({ action: "use_studio_video", genId: g.id, jobId: s.jobId })}>
                              اعتمده لهذا التوليد ✅
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <label className={`btn btn-ghost min-h-10 w-full cursor-pointer text-sm ${uploading ? "pointer-events-none opacity-60" : ""}`}>
              {uploading === g.id ? "نرفع الفيديو…" : "📤 ارفع الفيديو المعدّل من جهازك (بعد المونتاج أو التعديل الذكي)"}
              <input type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm" hidden disabled={Boolean(uploading)} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadEdited(g, f); }} />
            </label>

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
                  onApprove={() => send({ action: "approve_and_generate", versionId: g.revision!.id, resolution, ratio, durationSec: sec, model, ...voiceChoice(g) })}
                  approveLabel={`اعتمد وولّد من جديد · ≈ ${usd(cost)}`}
                  onSend={(mode, text) => send({ action: "revise", text, versionId: g.revision!.id, mode })}
                />
              </div>
            )}

            {g.lines.length > 0 && !generating && (
              <section className="space-y-2 rounded-2xl border border-line p-3" aria-label="حوار هذا المقطع">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold">🎙️ حوار هذا المقطع {sendVoices(g) && (dialogueReady(g) ? <span className="chip bg-teal text-xs text-white">جاهز ✅</span> : modeOf(g) === "make" ? <span className="chip text-xs">{g.lines.filter((l) => spokenOf(g, l.key)).length}/{g.lines.length}</span> : null)}</p>
                </div>
                {/* every generation asks: the dialogue made here, from your device, or none */}
                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="مصدر الحوار">
                  {([
                    ["make", "🎙️ تتولّد هنا", voicesOn ? "بأصوات JAWAD (ElevenLabs / MiniMax)" : "الأصوات غير مفعّلة على الخادم"],
                    ["upload", "📁 من جهازي", "ملف MP3 أو WAV سويته بنفسك (مثلًا من حسابك في ElevenLabs)"],
                    ["none", "🔇 بدون", "الفيديو يتولد بلا حوار مرجعي"],
                  ] as const).map(([m, label, hint]) => (
                    <button key={m} type="button" role="radio" aria-checked={modeOf(g) === m} title={hint} disabled={m === "make" && !voicesOn} className={`btn min-h-10 px-2 text-xs ${modeOf(g) === m ? "btn-secondary" : "btn-ghost"}`} onClick={() => setDialog({ ...dialog, [g.id]: m })}>
                      {label}
                    </button>
                  ))}
                </div>
                {dialogueSource && !dialog[g.id] && <p className="text-xs font-bold text-muted">حسب جوابك للسيناريست: {{ make: "الفويسات تتولّد هنا", upload: "من جهازك", self: "الفيديو يولّد الكلام بنفسه", later: "الحوار يُضاف في المونتاج" }[dialogueSource]} — تقدر تغيّره لهذا المقطع.</p>}
                {modeOf(g) === "make" && voicesOn && <p className="text-xs font-bold text-muted">الفويسات تتولّد هنا بأصوات الجواد وتنحط <b>أصوات مرجعية</b> مع الفيديو، والشفايف تتحرك عليها.</p>}
                {modeOf(g) === "upload" && <p className="text-xs font-bold text-muted">ملفك ينحط <b>صوت مرجعي</b> مع الفيديو، والشفايف تتحرك عليه.</p>}
                {modeOf(g) === "none" && <p className="text-xs font-bold text-muted">الفيديو يتولد بدون حوار مرجعي؛ Seedance قد يولّد كلامًا من عنده حسب البرومبت.</p>}
                {modeOf(g) === "upload" && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-muted">💡 سجّل الحوار أو صنّعه بأي برنامج أو حساب تبيه (ElevenLabs، MiniMax، تسجيل بصوتك…) بترتيب الجمل، وارفعه هنا: Seedance يحرّك الشفاه عليه ولا يولّد كلامًا غيره. من ٢ إلى {VIDEO_MODELS[model].maxSeconds} ثانية، حتى ١٥ ميجا.</p>
                    {trackOf(g) ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm">
                        <span className="flex-1 truncate font-bold" dir="ltr">📁 {trackOf(g)!.name}{trackOf(g)!.seconds ? ` · ${trackOf(g)!.seconds}s` : ""}</span>
                        {trackOf(g)!.url && <audio controls preload="none" src={trackOf(g)!.url!} className="h-8 w-40" />}
                        <button type="button" className="btn btn-ghost min-h-8 px-3 text-xs" disabled={trackBusy === g.id} onClick={() => removeTrack(g)}>احذفه</button>
                      </div>
                    ) : null}
                    <label className={`btn min-h-10 w-full cursor-pointer text-sm ${trackOf(g) ? "btn-ghost" : "btn-primary"}`}>
                      {trackBusy === g.id ? "يرفع…" : trackOf(g) ? "📁 ارفع ملفًا غيره" : "📁 اختر ملف الحوار من جهازك"}
                      <input type="file" accept="audio/mpeg,audio/mp3,audio/wav,.mp3,.wav" className="sr-only" disabled={trackBusy === g.id} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadTrack(g, f); }} />
                    </label>
                  </div>
                )}
                {modeOf(g) === "make" && voicesOn && (<>
                <p className="text-xs font-bold text-muted">💡 ولّد الصوت أول، وبعدها الفيديو: Seedance يلتزم بالصوت المرفق ويحرّك الشفاه عليه ولا يولّد كلامًا غيره.</p>
                {voice && [...new Set(g.lines.map((l) => l.speaker))].map((sp) => (
                  <div key={sp} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-extrabold">{sp}</span>
                    <select className="field min-h-9 w-full max-w-xs text-sm" aria-label={`صوت ${sp}`} value={voice.cast[sp] ?? ""} onChange={(e) => castVoice(sp, e.target.value)} disabled={Boolean(speaking)}>
                      <option value="" disabled>اختر صوتًا…</option>
                      {voice.voices.some((v) => v.group === "mine") && <optgroup label="أصواتي">{voice.voices.filter((v) => v.group === "mine").map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}</optgroup>}
                      <optgroup label="أصوات ElevenLabs الجاهزة">{voice.voices.filter((v) => v.group === "ready").map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}</optgroup>
                      {voice.voices.some((v) => v.group === "minimax") && <optgroup label="أصوات MiniMax الجاهزة">{voice.voices.filter((v) => v.group === "minimax").map((v) => <option key={v.value} value={v.value}>{v.name}</option>)}</optgroup>}
                    </select>
                    <VoiceDesigner projectId={projectId} speaker={sp} minimaxOn={voice.voices.some((v) => v.group === "minimax")} disabled={Boolean(speaking)} onCast={async (value) => { await castVoice(sp, value); setVoice(await api<VoiceState>(voicesUrl)); }} />
                  </div>
                ))}
                <ol className="space-y-1">
                  {g.lines.map((l) => {
                    const a = voice?.audios.find((x) => x.key === l.key);
                    const ok = spokenOf(g, l.key);
                    return (
                      <li key={l.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-2 text-sm">
                        <span className="flex-1"><b>{l.speaker}:</b> {l.line}</span>
                        <div className="w-full"><EmotionPicker provider={voice?.voices.find((v) => v.value === voice?.cast[l.speaker])?.provider ?? "elevenlabs"} value={feel[l.key] ?? ""} onChange={(v) => setFeel({ ...feel, [l.key]: v })} disabled={Boolean(speaking)} /></div>
                        {a?.url && ok && <audio controls preload="none" src={a.url} className="h-8 w-40" />}
                        <button
                          type="button"
                          className={`btn min-h-8 px-3 text-xs ${ok ? "btn-ghost" : "btn-secondary"}`}
                          disabled={Boolean(speaking) || !voice?.cast[l.speaker]}
                          title={!voice?.cast[l.speaker] ? `اختر صوتًا لـ${l.speaker} أول` : undefined}
                          onClick={() => speakLines([l.key])}
                        >
                          {speaking === l.key ? "يولّد…" : ok ? "🔁 من جديد" : "🎙️ ولّد"}
                        </button>
                      </li>
                    );
                  })}
                </ol>
                {voice && (
                  <button
                    type="button"
                    className={`btn min-h-10 w-full text-sm ${allSpoken(g) ? "btn-ghost" : "btn-primary"}`}
                    disabled={Boolean(speaking) || g.lines.some((l) => !voice.cast[l.speaker])}
                    onClick={() => speakLines(allSpoken(g) ? g.lines.map((l) => l.key) : g.lines.filter((l) => !spokenOf(g, l.key)).map((l) => l.key))}
                  >
                    {speaking ? "يولّد الأصوات…" : allSpoken(g) ? `🔁 ولّد أصوات هذا المقطع كلها من جديد (${g.lines.length})` : `🎙️ ولّد أصوات هذا المقطع (${g.lines.filter((l) => !spokenOf(g, l.key)).length})`}
                  </button>
                )}
                {!voice && !voiceError && <Spinner />}
                </>)}
                {voiceError && <p className="error-box text-sm">{voiceError}</p>}
              </section>
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
                  max={VIDEO_MODELS[model].maxSeconds}
                  step={1}
                  value={sec}
                  onChange={(e) => setSeconds({ ...seconds, [g.id]: Number(e.target.value) })}
                  className="w-full accent-gold"
                  dir="ltr"
                />
                <div className="flex justify-between text-xs font-bold text-muted" dir="ltr">
                  <span>{VIDEO_DURATION.min}s</span>
                  {clampVideoSeconds(g.durationSec) !== sec && <span>المخرج خطّط {clampVideoSeconds(g.durationSec)}s</span>}
                  <span>{VIDEO_MODELS[model].maxSeconds}s</span>
                </div>
                {sec < clampVideoSeconds(g.durationSec) && (
                  <p className="text-xs font-bold text-red-500">⚠️ أقصر من خطة المخرج؛ ممكن الحوار أو الأحداث ما تلحق تكتمل.</p>
                )}
              </div>
            )}
            {!generating && !busy && !g.questions && !g.revision && (
              <button
                className={`btn w-full ${mine.length ? "btn-ghost" : "btn-primary"}`}
                disabled={Boolean(speaking) || startingAll || runningNow >= MAX_AT_ONCE}
                title={runningNow >= MAX_AT_ONCE ? `فيه ${MAX_AT_ONCE} فيديوهات تتولد؛ انتظر واحد يخلص` : sendVoices(g) && !allSpoken(g) ? "نولّد أصوات المقطع أول تلقائيًا، وبعدها الفيديو" : undefined}
                onClick={() => void generate(g)}
              >
                {mine.length ? "🔁 ولّد نسخة ثانية" : "🎬 ولّد الفيديو"}{sendVoices(g) ? " 🎙️ بالأصوات" : ""} · {ratio === "9:16" ? "طولي" : "عرضي"} · {VIDEO_MODELS[model].label} · {VIDEO_RESOLUTIONS[resolution].label}
              </button>
            )}
          </article>
        );
      })}
      </div>

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
          <p className="text-sm font-bold text-muted">لا تنسى تحمّل فيديوهاتك.</p>
          <Link href={`${filmBase}/${projectId}/voices`} className="btn btn-primary w-full">🎙️ كمّل: الأصوات</Link>
        </div>
      ) : null}
      <RewindCard projectId={projectId} />
      {error && <p className="error-box">{error}</p>}
    </div>
    </EditsLeftContext>
  );
}
