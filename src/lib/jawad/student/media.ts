// «الطالب الذكي» — a video or a recording as material: what is said in it, written by ElevenLabs Scribe, becomes a
// written source («تفريغ: …») with a time every paragraph, and is then read and understood like anything typed.
// The file (uploaded to the student's storage) or the link (YouTube, TikTok…) is fetched by ElevenLabs itself; an
// uploaded file is deleted once it is written. Long ones run in the background, checked step by step.

import { UserError } from "@/lib/api";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { elevenTranscribeUrl, elevenTranscript, type Heard } from "@/lib/jawad/server/providers/elevenlabs";
import { STUDENT } from "@config/jawad/student";
import { storage } from "@/lib/storage";
import { getProject, sdb, sources, touch } from "./db";
import type { Handler, Job, StepResult } from "./jobs";

/** Scribe v2: $0.22 an hour of sound (elevenlabs.io/pricing/api, checked 2026-10-07). */
export const SCRIBE_USD_PER_HOUR = 0.22;
/** A link's length is only known once it is written: this much is held, and only the real length is charged. */
export const LINK_CEILING_HOURS = 3;
/** What ElevenLabs fetches by link: under 2 GB. */
export const MEDIA_MAX_BYTES = 2_000_000_000;
export const MEDIA_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm",
  "audio/aac": "aac",
  "audio/flac": "flac",
};
/** Stop waiting for ElevenLabs after this (a video of several hours is done well before). */
const GIVE_UP_MS = 3 * 3600_000;

export const mediaUsd = (seconds: number) => (Math.max(60, seconds) / 3600) * SCRIBE_USD_PER_HOUR + 0.005;

/** An https link (YouTube, TikTok or any hosted video / sound), or null. */
export function mediaLink(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (s.length > 2000) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.toString() : null;
  } catch {
    return null;
  }
}

const clock = (sec: number) => {
  const t = Math.max(0, Math.floor(sec));
  const h = Math.floor(t / 3600);
  const mm = String(Math.floor((t % 3600) / 60)).padStart(2, "0");
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** The words as paragraphs (a new one at a pause of 1.5 s, or after about 70 words), each with its time. */
export function transcriptText(h: Heard) {
  if (!h.words.length) return h.text.trim();
  const out: string[] = [];
  let cur: string[] = [];
  let start = h.words[0].start;
  let last = start;
  const flush = () => {
    if (cur.length) out.push(`[${clock(start)}] ${cur.join(" ").replace(/\s+([،,.؟?!:؛])/g, "$1")}`);
    cur = [];
  };
  for (const w of h.words) {
    if (cur.length && (w.start - last > 1.5 || cur.length >= 70)) {
      flush();
      start = w.start;
    }
    cur.push(w.text);
    last = w.end;
  }
  flush();
  return out.join("\n\n");
}

const seconds = (h: Heard) => (h.words.length ? h.words[h.words.length - 1].end : 0);

async function finish(job: Job, heard: Heard): Promise<StepResult> {
  const body = transcriptText(heard);
  if (!body) throw new UserError("ما لقينا كلام مسموع في هذا المقطع.");
  const project = await getProject(job.user_id, job.project_id);
  const name = String(job.input.name ?? "").slice(0, 200) || "مقطع";
  const ord = (await sources(project.id)).length;
  const { error } = await sdb()
    .from("student_sources")
    .insert({ project_id: project.id, user_id: job.user_id, ord, kind: "text", name: `تفريغ: ${name}`, body, mime: "text/plain", bytes: Buffer.byteLength(body), pages: 1, status: "ready" });
  if (error) throw error;
  // the uploaded file has done its job
  if (typeof job.input.path === "string") await storage.from(STUDENT.bucket).remove([job.input.path]).catch(() => null);
  await touch(project.id);
  const secs = seconds(heard) || Number(job.input.seconds) || 60;
  return { done: true, usd: mediaUsd(secs), stage: `فُرّغ ${clock(secs)} من الكلام` };
}

async function step(job: Job): Promise<StepResult> {
  const tid = typeof job.progress.tid === "string" ? job.progress.tid : null;
  try {
    if (!tid) {
      const url = typeof job.input.path === "string" ? (await storage.from(STUDENT.bucket).createSignedUrl(job.input.path, 6 * 3600)).data?.signedUrl : String(job.input.url ?? "");
      if (!url) throw new UserError("ما لقينا الملف. ارفعه مرة ثانية.");
      const r = await elevenTranscribeUrl({ url, languageCode: (job.input.language as string) || null });
      if ("heard" in r) return finish(job, r.heard);
      return { done: false, progress: { tid: r.id, since: Date.now() }, stage: "ElevenLabs يفرّغ الكلام…" };
    }
    const heard = await elevenTranscript(tid);
    if (heard) return finish(job, heard);
    const waited = Date.now() - Number(job.progress.since ?? Date.now());
    if (waited > GIVE_UP_MS) throw new UserError("طوّل التفريغ أكثر من اللازم. جرّب مرة ثانية.");
    await new Promise((ok) => setTimeout(ok, 6000));
    return { done: false, stage: `ElevenLabs يفرّغ الكلام… (${Math.max(1, Math.round(waited / 60_000))} د)` };
  } catch (e) {
    if (e instanceof ProviderError) throw new UserError(e.userMessage);
    throw e;
  }
}

export const mediaHandler: Handler = { label: "تفريغ الفيديو والصوت", step };
