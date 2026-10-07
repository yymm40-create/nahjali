"use client";

// «حيدرة كت» — talking with حيدرة: the microphone recorded in the browser (stopping by itself when the person goes
// quiet, in a conversation), what was said written by the server (ElevenLabs Scribe), and حيدرة's reply read aloud
// (ElevenLabs v4). The recording goes with the request (a short message), never to storage.

import { postJson } from "@/lib/fetch";

export interface Recording {
  blob: Blob;
  mime: string;
  seconds: number;
}

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
const SPEECH_LEVEL = 0.025;
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
    const now = performance.now();
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
      ok(cancelled || !spoke || seconds < 0.4 || !chunks.length ? null : { blob: new Blob(chunks, { type }), mime: type, seconds });
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
  const out = await postJson<{ text: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "voice_in", audio: await base64(r.blob), mime: r.mime, seconds: Math.round(r.seconds) });
  return out.text.trim();
}

let playing: HTMLAudioElement | null = null;

/** حيدرة says `text` aloud; resolves when it has finished (or was stopped with `hush`). */
export async function say(projectId: string, text: string) {
  const out = await postJson<{ audio: string; mime: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "voice_out", text });
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
  playing?.pause();
  playing = null;
}
