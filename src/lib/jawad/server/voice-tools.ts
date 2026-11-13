// «الجواد الذكي!» | JAWAD AI — «أدوات الصوت» on the server: «دبلجة» (ElevenLabs Dubbing), «غيّر الصوت» (ElevenLabs
// Voice Changer) and «حرّك الشفايف» (lip sync / a talking photo on fal.ai), each run as a job of its generator
// (config/jawad/generators.ts) so the price, the hold, the refund and «أعمالي» are the same as any generation.
// Server only.
//
// A video's sound is taken out, and a new sound put back on the same video, here on the server WITHOUT re-encoding
// (mediabunny copies the coded packets: no WebCodecs needed in Node). So the picture stays exactly as uploaded.
//
//   «غيّر الصوت»   sync:  [video → its sound] → voice changer → MP3  (+ the video with the MP3 put on it)
//   «دبلجة»        async: [video → its sound] → POST /v1/dubbing → poll → dubbed MP3 (+ the video with it put on it)
//   «حرّك الشفايف» async: links of the video (or photo) and the sound → fal queue → poll → the new video

import {
  ALL_FORMATS,
  BufferSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
  type InputAudioTrack,
  type InputVideoTrack,
} from "mediabunny";
import { billedSeconds, DUB_ID, dubForm, dubLang, LIPSYNC_ID, lipsyncRequest, lipsyncSeconds, lipsyncUsd, VOICE_CHANGE_MODEL, VOICE_TOOL_USD } from "@config/jawad/voice-tools";
import type { Settings } from "@config/jawad/types";
import { storage } from "@/lib/storage";
import { probe, sniff } from "../media";
import { elevenDubCreate, elevenDubFile, elevenDubStatus, elevenVoiceChange } from "./providers/elevenlabs";
import { falFile, falSubmit, falTask } from "./providers/fal";
import { ProviderError } from "./providers/common";
import { JAWAD_BUCKET } from "./runtime";
import { resolveVoice } from "./voices";
import type { UploadRow } from "./uploads";

/** What a voice tool's job keeps between sending and saving (jawad_jobs.inputs.voiceTool). */
export interface VoiceToolInputs {
  /** the seconds charged, and the provider's cost for them (USD) */
  seconds: number;
  usd: number;
  /** a dub of a video: the original video, to put the dubbed sound on */
  videoPath?: string;
  /** the fal endpoint a lip sync went to */
  model?: string;
  photo?: boolean;
  lang?: string;
}

export interface SavedFile {
  bytes: Buffer;
  mime: string;
  ext: string;
  durationMs?: number;
  width?: number;
  height?: number;
}

// ───────────────────────────── the sound of a video, and a sound on a video (no re-encoding) ─────────────────────────────

const inputOf = (bytes: Buffer) => new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });

/** Copies a track's coded packets as they are (its decoder config goes with the first one). */
async function copyAudio(track: InputAudioTrack, into: EncodedAudioPacketSource) {
  const decoderConfig = await track.getDecoderConfig();
  let first = true;
  for await (const p of new EncodedPacketSink(track).packets()) {
    await into.add(p, first && decoderConfig ? { decoderConfig } : undefined);
    first = false;
  }
  into.close();
}
async function copyVideo(track: InputVideoTrack, into: EncodedVideoPacketSource) {
  const decoderConfig = await track.getDecoderConfig();
  let first = true;
  for await (const p of new EncodedPacketSink(track).packets()) {
    await into.add(p, first && decoderConfig ? { decoderConfig } : undefined);
    first = false;
  }
  into.close();
}

/** The sound track of a video as an M4A (its packets copied as they are), or null when the video has no sound. */
export async function soundOfVideo(video: Buffer): Promise<Buffer | null> {
  const input = inputOf(video);
  const track = await input.getPrimaryAudioTrack();
  if (!track) return null;
  const codec = track.codec;
  if (!codec) throw new ProviderError("rejected", "صيغة صوت هذا الفيديو غير مدعومة؛ صدّره MP4 بصوت AAC وجرّب.", "video sound codec unknown");
  const out = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const src = new EncodedAudioPacketSource(codec);
  out.addAudioTrack(src);
  await out.start();
  await copyAudio(track, src);
  await out.finalize();
  return Buffer.from(out.target.buffer!);
}

/** The same video (its picture copied as it is) with `sound` as its only sound track: an MP4. */
export async function videoWithSound(video: Buffer, sound: Buffer): Promise<Buffer> {
  const vIn = inputOf(video);
  const aIn = inputOf(sound);
  const vTrack = await vIn.getPrimaryVideoTrack();
  const aTrack = await aIn.getPrimaryAudioTrack();
  if (!vTrack || !aTrack || !vTrack.codec || !aTrack.codec) throw new Error(`mux: video ${vTrack?.codec ?? "none"} · sound ${aTrack?.codec ?? "none"}`);
  const out = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const vs = new EncodedVideoPacketSource(vTrack.codec);
  const as = new EncodedAudioPacketSource(aTrack.codec);
  out.addVideoTrack(vs, { rotation: vTrack.rotation });
  out.addAudioTrack(as);
  await out.start();
  await copyVideo(vTrack, vs);
  await copyAudio(aTrack, as);
  await out.finalize();
  return Buffer.from(out.target.buffer!);
}

/** A saved file's kind and length, read from its bytes. */
function described(bytes: Buffer, fallback: { mime: string; ext: string }): SavedFile {
  const sn = sniff(new Uint8Array(bytes));
  const p = sn ? probe(new Uint8Array(bytes), sn) : {};
  if (sn?.kind === "video") return { bytes, mime: sn.mime, ext: sn.mime === "video/quicktime" ? "mov" : "mp4", durationMs: p.durationMs, width: p.width, height: p.height };
  if (sn?.kind === "audio") return { bytes, mime: sn.mime, ext: sn.mime === "audio/wav" ? "wav" : "mp3", durationMs: p.durationMs };
  return { bytes, ...fallback };
}

/** The sound a dub or a voice change sends: a recording as it is, or a video's own sound track. */
async function soundToSend(src: UploadRow, bytes: Buffer) {
  if (src.kind !== "video") return { bytes, mime: src.mime ?? "audio/mpeg", name: src.mime === "audio/wav" ? "sound.wav" : "sound.mp3" };
  const sound = await soundOfVideo(bytes);
  if (!sound) throw new ProviderError("rejected", "هذا الفيديو بلا صوت، فما فيه كلام نشتغل عليه. لم يُخصم منك شيء.", "video has no sound track");
  return { bytes: sound, mime: "audio/mp4", name: "sound.m4a" };
}

const sourceRow = (refs: UploadRow[]) => refs.find((r) => r.kind === "video") ?? refs.find((r) => r.kind === "audio");

// ───────────────────────────── «غيّر الصوت» (sync) ─────────────────────────────

export async function runVoiceChange(job: { user_id: string; inputs: { settings: Settings } }, refs: UploadRow[], download: (path: string) => Promise<Buffer>) {
  const s = job.inputs.settings;
  if (s.consent !== true) throw new ProviderError("rejected", "أكّد إن الصوت لك أو عندك إذن صاحبه. لم يُخصم منك شيء.", "voice change without consent");
  const voice = await resolveVoice(job.user_id, String(s.voice));
  if (!voice.ok) throw new ProviderError("rejected", voice.reason, `voice ${String(s.voice)}`);
  if (voice.provider !== "elevenlabs") throw new ProviderError("rejected", "هذا الصوت محفوظ في «صوت الجواد»؛ «غيّر الصوت» يشتغل بأصوات ElevenLabs. اختر صوتًا ثانيًا.", `voice provider ${voice.provider}`);
  const src = sourceRow(refs);
  if (!src) throw new ProviderError("rejected", "أضف التسجيل أو الفيديو.", "voice change: no source");
  const original = await download(src.storage_path);
  const send = await soundToSend(src, original);
  const audio = await elevenVoiceChange({ voiceId: voice.voiceId, file: send.bytes, mime: send.mime, name: send.name, model: VOICE_CHANGE_MODEL, denoise: s.denoise === true });
  const files: SavedFile[] = [described(audio, { mime: "audio/mpeg", ext: "mp3" })];
  const units: Record<string, unknown> = { seconds: billedSeconds(src.duration_ms), model: VOICE_CHANGE_MODEL };
  if (src.kind === "video") {
    // the video with its new sound; if that fails the new sound is still kept (it was made and paid for)
    try {
      files.unshift(described(await videoWithSound(original, audio), { mime: "video/mp4", ext: "mp4" }));
    } catch (e) {
      units.videoMux = String(e instanceof Error ? e.message : e).slice(0, 200);
    }
  }
  return { files, costUsd: (billedSeconds(src.duration_ms) * VOICE_TOOL_USD.voiceChangePerMin) / 60, units };
}

// ───────────────────────────── «دبلجة» and «حرّك الشفايف» (async) ─────────────────────────────

/** Sends a dub or a lip sync; returns the provider's id and what the job keeps until it is saved. */
export async function submitVoiceTool(job: { id: string; generator_id: string; inputs: { settings: Settings } }, refs: UploadRow[], download: (path: string) => Promise<Buffer>): Promise<{ taskId: string; keep: VoiceToolInputs }> {
  const s = job.inputs.settings;
  if (job.generator_id === DUB_ID) {
    const src = sourceRow(refs);
    if (!src) throw new ProviderError("rejected", "أضف الفيديو أو التسجيل.", "dub: no source");
    const send = await soundToSend(src, await download(src.storage_path));
    const r = await elevenDubCreate({ file: send.bytes, mime: send.mime, name: send.name, fields: { ...dubForm(s), name: `jawad-${job.id}` } });
    const seconds = billedSeconds(src.duration_ms);
    return { taskId: r.id, keep: { seconds, usd: (seconds * VOICE_TOOL_USD.dubPerMin) / 60, lang: dubLang(s.lang), ...(src.kind === "video" ? { videoPath: src.storage_path } : {}) } };
  }
  if (job.generator_id === LIPSYNC_ID) {
    if (s.consent !== true) throw new ProviderError("rejected", "أكّد إن الوجه والصوت لك أو عندك إذن أصحابهم. لم يُخصم منك شيء.", "lip sync without consent");
    const face = refs.find((r) => r.kind === "image") ?? refs.find((r) => r.kind === "video");
    const sound = refs.find((r) => r.kind === "audio");
    if (!face || !sound) throw new ProviderError("rejected", "أضف الفيديو (أو الصورة) والصوت.", "lip sync: missing refs");
    // fal fetches the files itself: short-lived links to our private copies
    const signed = (await storage.from(JAWAD_BUCKET).createSignedUrls([face.storage_path, sound.storage_path], 3 * 3600)).data ?? [];
    const [faceUrl, soundUrl] = [signed[0]?.signedUrl, signed[1]?.signedUrl];
    if (!faceUrl || !soundUrl) throw new ProviderError("rejected", "تعذّر تجهيز الملفات.", "lip sync: no signed url");
    const photo = face.kind === "image";
    const { model, input } = lipsyncRequest({ settings: s, photo, ...(photo ? { imageUrl: faceUrl } : { videoUrl: faceUrl }), audioUrl: soundUrl, videoMs: photo ? null : face.duration_ms, audioMs: sound.duration_ms });
    const taskId = await falSubmit(model, input);
    const seconds = lipsyncSeconds({ videoMs: photo ? null : face.duration_ms, audioMs: sound.duration_ms, photo });
    return { taskId, keep: { seconds, usd: lipsyncUsd({ videoMs: photo ? null : face.duration_ms, audioMs: sound.duration_ms, photo, settings: s }), model, photo } };
  }
  throw new ProviderError("rejected", "أداة غير معروفة.", `voice tool ${job.generator_id}`);
}

export type VoiceToolState = { status: "running" } | { status: "failed"; error: string } | { status: "succeeded"; files: () => Promise<SavedFile[]>; costUsd: number; units: Record<string, unknown> };

/** Where a sent dub or lip sync stands; a finished one carries how to fetch its files. */
export async function voiceToolState(job: { generator_id: string; provider_task_id: string; inputs: { voiceTool?: VoiceToolInputs } }, download: (path: string) => Promise<Buffer>): Promise<VoiceToolState> {
  const keep = job.inputs.voiceTool;
  const id = job.provider_task_id;
  if (job.generator_id === DUB_ID) {
    const st = await elevenDubStatus(id);
    if (st.status === "running") return { status: "running" };
    if (st.status === "failed") return { status: "failed", error: `dubbing ${st.error ?? "failed"}` };
    const lang = keep?.lang ?? "en";
    return {
      status: "succeeded",
      costUsd: keep?.usd ?? 0,
      units: { seconds: keep?.seconds, lang, dubbingId: id },
      files: async () => {
        const got = await elevenDubFile(id, lang);
        const first = described(got, { mime: "audio/mpeg", ext: "mp3" });
        // a video came back (not expected for a sound): its sound is the dub
        const sound = first.mime.startsWith("video/") ? ((await soundOfVideo(got)) ?? got) : got;
        const audio = first.mime.startsWith("video/") ? described(sound, { mime: "audio/mp4", ext: "m4a" }) : first;
        if (!keep?.videoPath) return [audio];
        const video = described(await videoWithSound(await download(keep.videoPath), sound), { mime: "video/mp4", ext: "mp4" });
        return [video, audio];
      },
    };
  }
  const t = await falTask(keep?.model ?? "", id);
  if (t.status === "queued" || t.status === "running") return { status: "running" };
  if (t.status === "failed" || !t.videoUrl) return { status: "failed", error: t.error ?? "lip sync failed" };
  const url = t.videoUrl;
  return {
    status: "succeeded",
    costUsd: keep?.usd ?? 0,
    units: { seconds: keep?.seconds, model: keep?.model, photo: keep?.photo ?? false },
    files: async () => [described(await falFile(url), { mime: "video/mp4", ext: "mp4" })],
  };
}

/** The voice tools that are followed after sending (the voice changer answers at once). */
export const asyncVoiceTool = (id: string) => id === DUB_ID || id === LIPSYNC_ID;
