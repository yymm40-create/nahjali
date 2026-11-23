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

/**
 * One slide's sound at the reel's rate, exactly `seconds` long (silence when it has none). `must`: the slide's video has
 * a sound track, so a sound that can't be read stops the reel (it was joined silent before, 17 Nov 2026).
 */
async function soundOf(url: string | null | undefined, seconds: number, must = false, n = 0): Promise<AudioBuffer> {
  const length = Math.max(1, Math.round(seconds * RATE));
  const out = new AudioBuffer({ length, numberOfChannels: 2, sampleRate: RATE });
  if (!url) return out;
  for (let i = 0; i < 3; i++) {
    try {
      // (not from the browser's cache: see NO_CACHE)
      const r = await fetch(url, NO_CACHE);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // an offline context decodes AND resamples to the reel's rate
      const heard = await new OfflineAudioContext(2, 1, RATE).decodeAudioData(await r.arrayBuffer());
      for (let c = 0; c < 2; c++) out.copyToChannel(heard.getChannelData(Math.min(c, heard.numberOfChannels - 1)).subarray(0, length), c);
      return out;
    } catch (e) {
      if (i < 2) await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
      else if (must) throw new Error(`ما قدرت أقرأ صوت الشريحة ${n} (${e instanceof Error ? e.message : "خطأ"}). جرّب «حوّله ريل» مرة ثانية.`);
    }
  }
  // a slide without a sound track stays silent
  return out;
}

type RGB = [number, number, number];
/** A slide's two edge colours (its top and bottom strips, averaged), read once per slide so the background stays still. */
export interface Edges { top: RGB; bottom: RGB }

/** The average colour of the slide's top and bottom strips (6% each), from a small copy of the frame. */
export function edgesOf(src: CanvasImageSource, sw: number, sh: number): Edges {
  const w = 24;
  const h = Math.max(8, Math.round((sh / sw) * w));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, w, h);
  const strip = Math.max(1, Math.round(h * 0.06));
  const avg = (y0: number): RGB => {
    const d = g.getImageData(0, y0, w, strip).data;
    const t: RGB = [0, 0, 0];
    for (let k = 0; k < d.length; k += 4) for (let ch = 0; ch < 3; ch++) t[ch] += d[k + ch];
    const n = d.length / 4;
    return [t[0] / n, t[1] / n, t[2] / n];
  };
  return { top: avg(0), bottom: avg(h - strip) };
}

const rgb = (c: RGB, k = 1) => `rgb(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)})`;

/**
 * Draws a frame (video canvas or picture) as the slide: full width, centred. The reel's empty bands above and below are
 * filled in code with a SIMPLE background that continues the slide: its own edge colour, deepening softly toward the
 * frame's edge, and the slide's edges melt into it (the owner, 17 Nov 2026: «يحاول يعبي المنطقة الفاضية في مقاس الريل
 * بالكود بشي بسيط، خلفية بسيطة» — the blurred, darkened copy read as black bands).
 */
function paint(ctx: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, edges: Edges) {
  const fit = Math.min(W / sw, H / sh);
  const dw = sw * fit;
  const dh = sh * fit;
  const x = (W - dw) / 2;
  const y = (H - dh) / 2;
  // the bands: the edge colour at the slide, a little deeper at the frame's edge
  const top = ctx.createLinearGradient(0, 0, 0, y + 2);
  top.addColorStop(0, rgb(edges.top, 0.55));
  top.addColorStop(1, rgb(edges.top));
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, y + 2);
  const bottom = ctx.createLinearGradient(0, y + dh - 2, 0, H);
  bottom.addColorStop(0, rgb(edges.bottom));
  bottom.addColorStop(1, rgb(edges.bottom, 0.55));
  ctx.fillStyle = bottom;
  ctx.fillRect(0, y + dh - 2, W, H - (y + dh) + 2);
  // a soft light behind the slide, so the bands are not flat
  const glow = ctx.createRadialGradient(W / 2, H / 2, dh * 0.2, W / 2, H / 2, H * 0.62);
  glow.addColorStop(0, "rgba(255,255,255,0.06)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(src, x, y, dw, dh);
  // the slide's top and bottom edges fade into the bands (no hard line where the slide ends)
  const fade = Math.min(48, dh * 0.04);
  if (y > 1) {
    const ft = ctx.createLinearGradient(0, y, 0, y + fade);
    ft.addColorStop(0, rgb(edges.top));
    ft.addColorStop(1, `rgba(${Math.round(edges.top[0])},${Math.round(edges.top[1])},${Math.round(edges.top[2])},0)`);
    ctx.fillStyle = ft;
    ctx.fillRect(x, y, dw, fade);
    const fb = ctx.createLinearGradient(0, y + dh - fade, 0, y + dh);
    fb.addColorStop(0, `rgba(${Math.round(edges.bottom[0])},${Math.round(edges.bottom[1])},${Math.round(edges.bottom[2])},0)`);
    fb.addColorStop(1, rgb(edges.bottom));
    ctx.fillStyle = fb;
    ctx.fillRect(x, y + dh - fade, dw, fade);
  }
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
  // about 8 Mbps: Instagram's own ceiling for a reel; at 0.32 bits a pixel a 49 s reel came out 114 MB (23 Nov 2026)
  const bitrate = Math.round(W * H * FPS * 0.13);
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
      // read from the slide's first frame and kept for the whole slide
      let edges: Edges | undefined;
      const input = inputs[k];
      const track = input ? await input.getPrimaryVideoTrack() : null;
      if (track) {
        const sink = new CanvasSink(track, { poolSize: 2 });
        const times = Array.from({ length: frames }, (_, i) => i / FPS);
        let i = 0;
        for await (const f of sink.canvasesAtTimestamps(times)) {
          if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
          if (f) {
            edges ??= edgesOf(f.canvas as CanvasImageSource, f.canvas.width, f.canvas.height);
            paint(ctx, f.canvas as CanvasImageSource, f.canvas.width, f.canvas.height, edges);
          }
          await source.add(frame / FPS, 1 / FPS);
          frame++;
          i++;
          if (i % 10 === 0) onProgress(Math.min(0.99, (at + i / FPS) / total));
        }
      } else {
        const img = s.image ? await loadImage(s.image) : null;
        for (let i = 0; i < frames; i++) {
          if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
          if (img) paint(ctx, img, img.naturalWidth, img.naturalHeight, (edges ??= edgesOf(img, img.naturalWidth, img.naturalHeight)));
          await source.add(frame / FPS, 1 / FPS);
          frame++;
        }
      }
      // a slide whose video carries sound must bring it into the reel
      const hasSound = input ? !!(await input.getPrimaryAudioTrack().catch(() => null)) : false;
      if (sound) await sound.add(await soundOf(s.video, frames / FPS, hasSound, k + 1));
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
