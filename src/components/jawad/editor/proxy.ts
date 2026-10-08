// «حيدرة كت» — «النسخة الخفيفة» (a preview proxy): a 4K video (or anything over 1080p) stutters in the preview — the
// browser streams 50–100 Mbit/s from storage and decodes four times the pixels on every seek. So each such video
// gets a light copy once, made right here in the browser (WebCodecs through Mediabunny: H.264, 1080p on its long
// side, a key frame every second so seeking is instant) and kept on this device (the browser's private file system):
// the preview plays the copy, the export always uses the original 4K. Nothing is uploaded and nothing is paid.

import { ALL_FORMATS, BlobSource, Conversion, Input, Mp4OutputFormat, Output, QUALITY_MEDIUM, StreamTarget, UrlSource, type StreamTargetChunk } from "mediabunny";

/** The long side of the light copy (the preview never needs more: the canvas is the project's size). */
export const PROXY_SIDE = 1920;

/** A video that needs a light copy: bigger than 1080p on either side. */
export const needsProxy = (a: { kind: string; width?: number | null; height?: number | null }) =>
  a.kind === "video" && Math.max(a.width ?? 0, a.height ?? 0) > PROXY_SIDE + 8 && Math.min(a.width ?? 0, a.height ?? 0) > 1088;

async function dir(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const root = await navigator.storage.getDirectory();
    return await root.getDirectoryHandle("haidara-proxies", { create: true });
  } catch {
    return null;
  }
}

const name = (assetId: string) => `${assetId.replace(/[^a-zA-Z0-9_-]/g, "_")}.mp4`;

/** The light copy kept on this device, as a link the player can play, or null. */
export async function proxyUrl(assetId: string): Promise<string | null> {
  const d = await dir();
  if (!d) return null;
  try {
    const f = await (await d.getFileHandle(name(assetId))).getFile();
    return f.size > 1000 ? URL.createObjectURL(f) : null;
  } catch {
    return null;
  }
}

/**
 * Makes the light copy of a video (from the file itself when it's at hand, else from its link) and keeps it on this
 * device. `onProgress` gets 0–1. Resolves to the copy's link, or null when this browser can't make it.
 */
export async function makeProxy(assetId: string, source: Blob | string, onProgress?: (p: number) => void, signal?: AbortSignal): Promise<string | null> {
  const d = await dir();
  if (!d || typeof VideoEncoder === "undefined") return null;
  const tmp = `${name(assetId)}.part`;
  const handle = await d.getFileHandle(tmp, { create: true });
  const file = await handle.createWritable();
  const writable = new WritableStream<StreamTargetChunk>({
    write: (chunk) => file.write({ type: "write", position: chunk.position, data: chunk.data }),
  });
  const input = new Input({ source: typeof source === "string" ? new UrlSource(source) : new BlobSource(source), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: false }), target: new StreamTarget(writable, { chunked: true }) });
  try {
    const conv = await Conversion.init({
      input,
      output,
      tracks: "primary",
      video: (track) => {
        const long = Math.max(track.displayWidth, track.displayHeight);
        const k = Math.min(1, PROXY_SIDE / long);
        // even sizes (H.264 wants them)
        const w = Math.max(2, Math.round((track.displayWidth * k) / 2) * 2);
        return { width: w, codec: "avc", bitrate: QUALITY_MEDIUM, keyFrameInterval: 1, forceTranscode: true, hardwareAcceleration: "prefer-hardware" };
      },
      audio: { codec: "aac" },
    });
    if (!conv.isValid) throw new Error("ما قدرت أحوّل هالفيديو هنا.");
    conv.onProgress = (p) => onProgress?.(p);
    signal?.addEventListener("abort", () => void conv.cancel(), { once: true });
    await conv.execute();
    await file.close();
    // the finished copy takes its real name (a half-made one never plays)
    const done = await (await d.getFileHandle(tmp)).getFile();
    const final = await (await d.getFileHandle(name(assetId), { create: true })).createWritable();
    await final.write(done);
    await final.close();
    await d.removeEntry(tmp).catch(() => {});
    return URL.createObjectURL(await (await d.getFileHandle(name(assetId))).getFile());
  } catch (e) {
    await file.close().catch(() => {});
    await d.removeEntry(tmp).catch(() => {});
    if (signal?.aborted) return null;
    throw e;
  }
}

/** Forgets a video's light copy (its file was deleted from the project). */
export async function dropProxy(assetId: string) {
  const d = await dir();
  await d?.removeEntry(name(assetId)).catch(() => {});
}
