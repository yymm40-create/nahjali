"use client";

// «حيدرة كت» — talking with حيدرة: the microphone recorded in the browser (stopping by itself when the person goes
// quiet, in a conversation), what was said written by the server (ElevenLabs Scribe), and حيدرة's reply read aloud
// (ElevenLabs v4). The recording goes with the request (a short message), never to storage.

import { postJson } from "@/lib/fetch";

export interface Recording {
  blob: Blob;
  mime: string;
  seconds: number;
  /** the loudest moment (RMS, 0–1) the meter saw */
  peak: number;
  /** whether the meter worked at all (a context that never started reads 0) */
  meter: boolean;
}

/** Below this the recording is silence (a muted or wrong input device): it is not sent. */
export const SILENT_PEAK = 0.004;

export interface RecordingHandle {
  /** the recording, or null when nothing was said (or it was cancelled) */
  done: Promise<Recording | null>;
  /** ends it now and keeps what was said */
  stop: () => void;
  /** ends it and throws it away */
  cancel: () => void;
}

const TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
/** Louder than this (RMS, 0–1) counts as talking. */
const SPEECH_LEVEL = 0.012;
/** Quiet this long after talking ends a conversation turn. */
const QUIET_MS = 1300;
/** A conversation turn with nothing said is dropped after this. */
const WAIT_MS = 10_000;
const MAX_MS = 110_000;

export const canTalk = () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

/**
 * Starts recording. `untilQuiet`: ends by itself once the person has spoken and then stayed quiet (a conversation);
 * otherwise it runs until `stop()`. `onLevel` gets the loudness (0–1) to draw.
 */
export async function record(o: { untilQuiet?: boolean; onLevel?: (v: number) => void } = {}): Promise<RecordingHandle> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    throw new Error("ما قدرت أفتح المايك. اسمح للموقع يستخدم المايك من إعدادات المتصفح.");
  }
  const mime = TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
  const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
  const chunks: Blob[] = [];
  const started = performance.now();
  let spoke = false;
  let lastLoud = started;
  let cancelled = false;

  const ctx = new AudioContext();
  // a context made after an await starts «suspended» in Safari and some Chrome builds: its meter then reads 0 forever,
  // and a voice message used to be dropped as «nothing said» without a word
  void ctx.resume().catch(() => {});
  let heardAny = false;
  let peak = 0;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (const v of buf) sum += v * v;
    const level = Math.sqrt(sum / buf.length);
    o.onLevel?.(Math.min(1, level * 8));
    if (level > 0) heardAny = true;
    if (level > peak) peak = level;
    const now = performance.now();
    // a meter that never moves (the context never started): no silence detection; a turn ends after 8 s
    if (!heardAny && o.untilQuiet && now - started > 1500) {
      spoke = true;
      if (now - started > 8000) end();
      return;
    }
    if (level > SPEECH_LEVEL) {
      spoke = true;
      lastLoud = now;
    }
    if (now - started > MAX_MS) end();
    else if (o.untilQuiet && spoke && now - lastLoud > QUIET_MS) end();
    else if (o.untilQuiet && !spoke && now - started > WAIT_MS) {
      cancelled = true;
      end();
    }
  }, 60);

  const done = new Promise<Recording | null>((ok) => {
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => {});
      o.onLevel?.(0);
      const seconds = (performance.now() - started) / 1000;
      const type = (rec.mimeType || mime || "audio/webm").split(";")[0];
      // a voice message ends by the person's own press: kept even when the meter didn't see the voice
      const said = o.untilQuiet ? spoke : true;
      ok(cancelled || !said || seconds < 0.6 || !chunks.length ? null : { blob: new Blob(chunks, { type }), mime: type, seconds, peak, meter: heardAny });
    };
  });
  function end() {
    if (rec.state !== "inactive") rec.stop();
  }
  rec.start(250);
  return {
    done,
    stop: end,
    cancel: () => {
      cancelled = true;
      end();
    },
  };
}

const base64 = (blob: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => fail(new Error("ما قدرت أقرأ التسجيل."));
    r.readAsDataURL(blob);
  });

/** What was said, written. */
export async function hear(projectId: string, r: Recording) {
  const out = await postJson<{ text: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "voice_in", audio: await base64(r.blob), mime: r.mime, seconds: Math.max(1, Math.round(r.seconds)) });
  return out.text.trim();
}

let playing: HTMLAudioElement | null = null;

/** حيدرة says `text` aloud; resolves when it has finished (or was stopped with `hush`). */
/** Who reads حيدرة's replies (kept on this device): a provider, or one of the person's own voices («v:<id>»). */
export const REPLY_VOICE_KEY = "jw-haydara-voice";
export function replyVoice(): string {
  try {
    return localStorage.getItem(REPLY_VOICE_KEY) || "auto";
  } catch {
    return "auto";
  }
}

/**
 * «🖥️ صوت الجهاز»: read by the browser's own speech (free, nothing sent anywhere): the device's Arabic voice when it
 * has one (e.g. «Majed» on Apple devices). Resolves when it has finished, or at once when the browser has no speech.
 */
export function sayOnDevice(text: string) {
  return new Promise<void>((ok) => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return ok();
    const clean = text.replace(/```[\s\S]*?```/g, " ").replace(/https?:\/\/\S+/g, " ").replace(/[*_`#>|]/g, "").replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").trim().slice(0, 700);
    if (!clean) return ok();
    const u = new SpeechSynthesisUtterance(clean);
    const arabic = /[\u0600-\u06FF]/.test(clean);
    u.lang = arabic ? "ar-SA" : "en-US";
    const voices = synth.getVoices();
    const v = voices.find((x) => x.lang.toLowerCase().startsWith(arabic ? "ar" : "en") && /majed|maged|tarik|hamed|naayf/i.test(x.name)) ?? voices.find((x) => x.lang.toLowerCase().startsWith(arabic ? "ar" : "en"));
    if (v) u.voice = v;
    u.rate = 1;
    u.onend = () => ok();
    u.onerror = () => ok();
    synth.cancel();
    synth.speak(u);
  });
}

export async function say(projectId: string, text: string) {
  if (replyVoice() === "device") return sayOnDevice(text);
  const out = await postJson<{ audio: string; mime: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "voice_out", text, voice: replyVoice() });
  hush();
  const a = new Audio(`data:${out.mime};base64,${out.audio}`);
  playing = a;
  await new Promise<void>((ok) => {
    a.onended = () => ok();
    a.onerror = () => ok();
    a.onpause = () => ok();
    a.play().catch(() => ok());
  });
  if (playing === a) playing = null;
}

/** Stops حيدرة talking. */
export function hush() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  playing?.pause();
  playing = null;
}

/**
 * Any recording (WebM/Opus, MP4, WAV…) as a mono 16-bit WAV at `rate`, at most `maxSec` long — what the voice
 * libraries accept for «بصمة صوتك». Decoded by the browser itself.
 */
export async function wavOf(blob: Blob, rate = 24000, maxSec = 170): Promise<{ wav: Blob; seconds: number }> {
  const ctx = new AudioContext();
  let buf: AudioBuffer;
  try {
    buf = await ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    throw new Error("ما قدرت أقرأ هذا الصوت في المتصفح؛ جرّب Chrome.");
  } finally {
    void ctx.close().catch(() => {});
  }
  const seconds = Math.min(maxSec, buf.duration);
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(seconds * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = buf;
  src.connect(off.destination);
  src.start(0, 0, seconds);
  const out = (await off.startRendering()).getChannelData(0);
  const data = new DataView(new ArrayBuffer(44 + out.length * 2));
  const text = (at: number, s: string) => [...s].forEach((ch, i) => data.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  data.setUint32(4, 36 + out.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  text(36, "data");
  data.setUint32(40, out.length * 2, true);
  for (let i = 0; i < out.length; i++) data.setInt16(44 + i * 2, Math.max(-1, Math.min(1, out[i])) * 0x7fff, true);
  return { wav: new Blob([data.buffer], { type: "audio/wav" }), seconds };
}

/** A blob as base64 (no data: prefix). */
export const blobBase64 = (blob: Blob) =>
  new Promise<string>((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1] ?? "");
    r.onerror = () => fail(new Error("ما قدرت أقرأ الملف."));
    r.readAsDataURL(blob);
  });
