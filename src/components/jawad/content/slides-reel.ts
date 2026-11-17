// «صانع المحتوى» · a motion carousel joined into ONE reel (the owner, 15 Nov 2026: «خل خيار ان يصير ريل، يعني صفحات
// الموشن كاروسيل تنجمع في مقطع واحد»). In the browser, with the same encoder as the export (Mediabunny):
//   - the reel is 1080×1920; each slide sits across the full width, centred (a 4:5 slide leaves 285 px above and below —
//     Instagram's safe zones), on a blurred, darkened copy of itself;
//   - slides play one after another, each for its own length, with its own sound; a still slide (a picture) holds 3 s;
//   - the result is an MP4 the person downloads.
import { ALL_FORMATS, AudioBufferSource, BufferTarget, CanvasSink, CanvasSource, getFirstEncodableVideoCodec, Input, Mp4OutputFormat, Output, UrlSource } from "mediabunny";
import { soundCodec } from "@/components/jawad/editor/export";

export interface ReelSlide {
  /** the slide's MP4 (a motion slide) */
  video?: string | null;
  /** the slide's picture (a still slide) */
  image?: string | null;
}

const W = 1080;
const H = 1920;
const FPS = 30;
const RATE = 48000;
/** how long a still slide is shown */
export const STILL_SECONDS = 3;

/**
 * The slides' videos are read fresh from storage, never from the browser's cache: the page's own player has already
 * cached each video WITHOUT the cross-origin grant (a plain <video>), and Chrome then refuses to hand that cached copy
 * to a script — «حوّله ريل» failed with «Failed to fetch» on every carousel whose slides had been played or shown
 * (17 Nov 2026).
 */
const NO_CACHE: RequestInit = { cache: "no-store" };

/** One slide's sound at the reel's rate, exactly `seconds` long (silence when it has none). */
async function soundOf(url: string | null | undefined, seconds: number): Promise<AudioBuffer> {
  const length = Math.max(1, Math.round(seconds * RATE));
  const out = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: RATE });
  if (!url) return out;
  try {
    // (not from the browser's cache: see NO_CACHE)
    const bytes = await (await fetch(url, NO_CACHE)).arrayBuffer();
    // an offline context decodes AND resamples to the reel's rate
    const heard = await new OfflineAudioContext(2, 1, RATE).decodeAudioData(bytes);
    for (let c = 0; c < 2; c++) out.copyToChannel(heard.getChannelData(Math.min(c, heard.numberOfChannels - 1)).subarray(0, length), c);
  } catch {
    // a slide without a sound track stays silent
  }
  return out;
}

/** Draws a frame (video canvas or picture) as the slide: full width, centred, over its own blurred copy. */
function paint(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number) {
  ctx.fillStyle = "#0b0c0f";
  ctx.fillRect(0, 0, W, H);
  // the background: the same frame covering the reel, blurred and darkened (a plain dark fill where blur is missing)
  const cover = Math.max(W / sw, H / sh);
  ctx.save();
  ctx.filter = "blur(48px) brightness(0.45)";
  ctx.drawImage(src, (W - sw * cover) / 2, (H - sh * cover) / 2, sw * cover, sh * cover);
  ctx.restore();
  const fit = Math.min(W / sw, H / sh);
  const dw = sw * fit;
  const dh = sh * fit;
  ctx.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  return img;
}

/** The slides joined into one 9:16 MP4. `onProgress` gets 0–1. */
export async function joinSlidesToReel(slides: ReelSlide[], onProgress: (p: number) => void, signal?: AbortSignal): Promise<Blob> {
  const list = slides.filter((s) => s.video || s.image);
  if (!list.length) throw new Error("ما فيه شرائح جاهزة.");
  const bitrate = Math.round(W * H * FPS * 0.32);
  const codec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width: W, height: H, bitrate });
  if (!codec) throw new Error("متصفحك ما يقدر يطلّع فيديو بمقاس الريل. جرّب Chrome أو Edge على الكمبيوتر.");
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const source = new CanvasSource(canvas, { codec, bitrate, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });
  const aCodec = await soundCodec(192_000);
  const sound = aCodec ? new AudioBufferSource({ codec: aCodec.codec, bitrate: aCodec.bitrate }) : null;
  if (sound) output.addAudioTrack(sound);
  await output.start();
  // each slide's length first, for the progress
  const inputs = list.map((s) => (s.video ? new Input({ source: new UrlSource(s.video, { maxCacheSize: Infinity, requestInit: NO_CACHE }), formats: ALL_FORMATS }) : null));
  const lengths = await Promise.all(inputs.map((i) => (i ? i.computeDuration().catch(() => STILL_SECONDS) : Promise.resolve(STILL_SECONDS))));
  const total = lengths.reduce((a, b) => a + b, 0);
  let at = 0;
  let frame = 0;
  try {
    for (let k = 0; k < list.length; k++) {
      const s = list[k];
      const seconds = lengths[k];
      const frames = Math.max(1, Math.round(seconds * FPS));
      const input = inputs[k];
      const track = input ? await input.getPrimaryVideoTrack() : null;
      if (track) {
        const sink = new CanvasSink(track, { poolSize: 2 });
        const times = Array.from({ length: frames }, (_, i) => i / FPS);
        let i = 0;
        for await (const f of sink.canvasesAtTimestamps(times)) {
          if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
          if (f) paint(ctx, f.canvas as CanvasImageSource, f.canvas.width, f.canvas.height);
          await source.add(frame / FPS, 1 / FPS);
          frame++;
          i++;
          if (i % 10 === 0) onProgress(Math.min(0.99, (at + i / FPS) / total));
        }
      } else {
        const img = s.image ? await loadImage(s.image) : null;
        for (let i = 0; i < frames; i++) {
          if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
          if (img) paint(ctx, img, img.naturalWidth, img.naturalHeight);
          await source.add(frame / FPS, 1 / FPS);
          frame++;
        }
      }
      if (sound) await sound.add(await soundOf(s.video, frames / FPS));
      at += seconds;
      onProgress(Math.min(0.99, at / total));
    }
  } catch (e) {
    await output.cancel().catch(() => undefined);
    throw e;
  } finally {
    inputs.forEach((i) => i?.dispose?.());
  }
  source.close();
  sound?.close();
  await output.finalize();
  onProgress(1);
  return new Blob([(output.target as BufferTarget).buffer!], { type: "video/mp4" });
}
