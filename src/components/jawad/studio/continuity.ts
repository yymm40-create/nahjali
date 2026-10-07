"use client";

// «التعديل الذكي» of a part: the seconds of the video itself around the cut, cut out in the browser and uploaded as
// video references, so the new piece carries on what is there (motion, camera, light, voices, effects, music).

import { ALL_FORMATS, BufferTarget, Conversion, getFirstEncodableAudioCodec, Input, Mp4OutputFormat, Output, UrlSource } from "mediabunny";
import { api, postJson } from "@/lib/fetch";
import { putWithProgress } from "./upload";

let aacReady: Promise<void> | null = null;
async function aacOk() {
  const native = "AudioEncoder" in window ? await getFirstEncodableAudioCodec(["aac"]).catch(() => null) : null;
  if (native) return true;
  aacReady ??= import("@mediabunny/aac-encoder").then((m) => m.registerAacEncoder());
  await aacReady.catch(() => {});
  return Boolean(await getFirstEncodableAudioCodec(["aac"]).catch(() => null));
}

/** The video from `from` to `to` (seconds) as an MP4 (H.264, with its sound when it has one). */
export async function cutClip(url: string, from: number, to: number): Promise<Blob> {
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const withSound = await aacOk();
  const conv = await Conversion.init({
    input,
    output,
    trim: { start: from, end: to },
    // decoded and encoded again, so it starts and ends exactly where asked
    video: { forceTranscode: true, codec: "avc" },
    audio: withSound ? { forceTranscode: true, codec: "aac" } : { discard: true },
    showWarnings: false,
  });
  if (!conv.isValid) throw new Error("متصفحك ما يقدر يقص المقطع؛ جرّب Chrome على الكمبيوتر.");
  await conv.execute();
  const buf = (output.target as BufferTarget).buffer;
  if (!buf) throw new Error("تعذّر قص المقطع.");
  return new Blob([buf], { type: "video/mp4" });
}

/** Cut and upload one continuity piece; returns its upload id (ready to be a reference). */
export async function uploadContinuity(url: string, r: { from: number; to: number }, name: string): Promise<string> {
  const blob = await cutClip(url, r.from, r.to);
  const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "video", mime: "video/mp4", bytes: blob.size, fileName: `${name}.mp4` });
  await putWithProgress(signed.signedUrl, new File([blob], `${name}.mp4`, { type: "video/mp4" }), "video/mp4", () => {});
  const conf = await api<{ upload: { id: string; status: string; error: string | null } }>("/api/jawad/uploads/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: signed.id }) });
  if (conf.upload.status !== "ready") throw new Error(conf.upload.error ?? "المقطع المرجعي ما انقبل.");
  return conf.upload.id;
}
