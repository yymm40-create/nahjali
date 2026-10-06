// «حيدر كات» — the browser side of media: what a file is (bytes + Mediabunny's reading of it), its upload, and
// small pictures of videos for the timeline and the library.

import { ALL_FORMATS, BlobSource, Input } from "mediabunny";
import { editorSniff, KIND_AR } from "@/lib/editor/media";
import type { AssetKind } from "@/lib/editor/model";

export interface Probed {
  kind: AssetKind;
  container: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  /** the browser can show it while editing (some phone videos, e.g. HEVC on older Chrome, can't) */
  playable: boolean;
}

export async function probe(file: File): Promise<Probed> {
  const s = editorSniff(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  if (!s) throw new Error(`«${file.name}»: نوع غير مقبول. المقبول: فيديو MP4/MOV/WebM، صوت MP3/WAV/M4A/AAC/OGG/FLAC، صور PNG/JPG/WEBP.`);
  if (s.kinds[0] === "image") {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { kind: "image", container: s.container, durationMs: null, width: img.naturalWidth, height: img.naturalHeight, hasAudio: false, playable: true };
    } catch {
      throw new Error(`«${file.name}»: تعذّر قراءة الصورة.`);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const [v, a, d] = await Promise.all([s.kinds.includes("video") ? input.getPrimaryVideoTrack() : null, input.getPrimaryAudioTrack(), input.computeDuration()]);
    if (!v && !a) throw new Error(`«${file.name}»: ما فيه صورة ولا صوت نقدر نقرأه.`);
    const kind: AssetKind = v ? "video" : "audio";
    if (!s.kinds.includes(kind)) throw new Error(`«${file.name}»: محتواه ${KIND_AR[kind]} بصيغة ما نقبلها.`);
    const playable = v ? await v.canDecode().catch(() => false) : await a!.canDecode().catch(() => false);
    return {
      kind,
      container: s.container,
      durationMs: Number.isFinite(d) && d > 0 ? Math.round(d * 1000) : null,
      width: v ? v.displayWidth : null,
      height: v ? v.displayHeight : null,
      hasAudio: !!a,
      playable,
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("«")) throw err;
    throw new Error(`«${file.name}»: تعذّر قراءة الملف؛ قد يكون تالفًا.`);
  } finally {
    input.dispose();
  }
}

/** Reads a short file name for the library. */
export const shortName = (name: string) => name.replace(/\.[^.]+$/, "").slice(0, 60) || "ملف";

// ---------- thumbnails ----------

const thumbs = new Map<string, Promise<string | null>>();

/** A small picture of a video (a moment near its start) or of an image; cached per file. */
export function thumbnail(id: string, kind: AssetKind, url: string | null): Promise<string | null> {
  if (!url || kind === "audio") return Promise.resolve(null);
  if (kind === "image") return Promise.resolve(url);
  let p = thumbs.get(id);
  if (!p) {
    p = videoThumb(url);
    thumbs.set(id, p);
  }
  return p;
}

function videoThumb(url: string) {
  return new Promise<string | null>((done) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    const finish = (r: string | null) => {
      clearTimeout(timer);
      v.removeAttribute("src");
      v.load();
      done(r);
    };
    const timer = setTimeout(() => finish(null), 15_000);
    v.onloadedmetadata = () => {
      v.currentTime = Math.min(1, (v.duration || 2) / 3);
    };
    v.onseeked = () => {
      try {
        const h = 90;
        const w = Math.max(1, Math.round((v.videoWidth / v.videoHeight) * h)) || 160;
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        c.getContext("2d")!.drawImage(v, 0, 0, w, h);
        finish(c.toDataURL("image/jpeg", 0.7));
      } catch {
        finish(null);
      }
    };
    v.onerror = () => finish(null);
    v.src = url;
  });
}

// ---------- frames for Claude ----------

/**
 * `n` pictures spread over `[fromMs, toMs)` of a video (or the picture itself), as small JPEGs (base64, no prefix):
 * what Claude looks at to understand a clip. One file at a time, a seek per picture.
 */
export async function framesOf(url: string, kind: AssetKind, fromMs: number, toMs: number, n = 6, height = 360): Promise<{ t: number; data: string }[]> {
  const grab = (src: CanvasImageSource, w0: number, h0: number) => {
    const h = Math.min(height, h0);
    const w = Math.max(1, Math.round((w0 / h0) * h));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(src, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.72).split(",")[1];
  };
  if (kind === "image") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    return [{ t: fromMs, data: grab(img, img.naturalWidth, img.naturalHeight) }];
  }
  const v = document.createElement("video");
  v.crossOrigin = "anonymous";
  v.muted = true;
  v.preload = "auto";
  v.playsInline = true;
  v.src = url;
  try {
    await new Promise<void>((ok, bad) => {
      v.onloadeddata = () => ok();
      v.onerror = () => bad(new Error("video"));
      setTimeout(() => bad(new Error("timeout")), 20_000);
    });
    const out: { t: number; data: string }[] = [];
    for (let i = 0; i < n; i++) {
      const t = fromMs + ((toMs - fromMs) * (i + 0.5)) / n;
      await new Promise<void>((ok) => {
        v.onseeked = () => ok();
        v.currentTime = Math.min(t / 1000, Math.max(0, (v.duration || 0) - 0.05));
        setTimeout(ok, 4000);
      });
      out.push({ t: Math.round(t), data: grab(v, v.videoWidth, v.videoHeight) });
    }
    return out;
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}
