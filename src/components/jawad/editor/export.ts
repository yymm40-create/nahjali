// «الممنتج الذكي» — the export, made entirely in the person's browser (WebCodecs through Mediabunny, MPL-2.0): no
// server time, no upload of the media. Frame by frame: each clip's source is decoded in order, drawn with the same
// drawFrame as the preview and encoded to H.264 (or what the browser can encode) in an MP4. The sound is mixed in
// short pieces with the Web Audio API, so even a long project never holds all its sound in memory at once.

import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  UrlSource,
  type WrappedCanvas,
} from "mediabunny";
import { clipEnd, duration, gainAt, hasSoundFx, sourceTime, voiceSpans, type Clip, type Timeline, type Track } from "@/lib/editor/model";
import { drawFrame, exportSize, layersAt, type Frame } from "./render";
import { stretch } from "./stretch";
import { Masker } from "./segment";
import { decodeWhole } from "./audio";
import { clipSound } from "./voice";

export interface ExportAsset {
  id: string;
  kind: "video" | "audio" | "image";
  url: string | null;
  hasAudio: boolean;
}

export interface ExportResult {
  blob: Blob;
  width: number;
  height: number;
  codec: string;
  audio: string | null;
  /** the project has sound but this browser can't encode it: the file came out silent */
  lostSound: boolean;
}

const SAMPLE_RATE = 48_000;
/** Seconds of sound mixed at a time (and the video frames of the same seconds right after, so both stay interleaved). */
const CHUNK_S = 5;

export class ExportError extends Error {}

/** Can this browser make the file at all? (WebCodecs: Chrome/Edge 94+, Safari 16.4+/17, recent Firefox.) */
export const canExport = () => typeof window !== "undefined" && "VideoEncoder" in window;

export async function exportVideo(
  tl: Timeline,
  assets: ExportAsset[],
  quality: 720 | 1080,
  onProgress: (p: number) => void,
  signal: AbortSignal,
): Promise<ExportResult> {
  const total = duration(tl);
  if (!total) throw new ExportError("التايملاين فاضي؛ أضف مقطعًا أول.");
  const { width, height } = exportSize(tl, quality);
  const fps = tl.fps;
  const byId = new Map(assets.map((a) => [a.id, a]));
  for (const track of tl.tracks) {
    for (const c of track.clips) {
      if (c.assetId && !byId.get(c.assetId)?.url) throw new ExportError("أحد الملفات في التايملاين ما عاد موجود (ربما انحذف). احذف مقطعه وجرّب.");
    }
  }

  const videoCodec = await getFirstEncodableVideoCodec(["avc", "hevc", "vp9", "av1"], { width, height, quality: QUALITY_HIGH, frameRate: fps });
  if (!videoCodec) throw new ExportError(`متصفحك ما يقدر يصدّر فيديو بدقة ${quality}p. جرّب Chrome أو Edge على الكمبيوتر، أو دقة أقل.`);

  // sound: clips we can hear
  const hasSound = (c: Clip) => !c.text && !!c.assetId && byId.get(c.assetId)!.kind !== "image" && byId.get(c.assetId)!.hasAudio;
  const audible: { track: Track; c: Clip }[] = tl.tracks.flatMap((track) => (track.muted ? [] : track.clips.filter((c) => c.volume > 0 && hasSound(c)).map((c) => ({ track, c }))));
  const spans = voiceSpans(tl, hasSound);
  const audioCodec = audible.length ? await soundCodec() : null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: videoCodec, bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: fps });
  const audio = audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH }) : null;
  if (audio) output.addAudioTrack(audio);

  // one decoder input per file, opened lazily
  const inputs = new Map<string, Input>();
  const input = (a: ExportAsset) => {
    let i = inputs.get(a.id);
    if (!i) {
      i = new Input({ source: new UrlSource(a.url!), formats: ALL_FORMATS });
      inputs.set(a.id, i);
    }
    return i;
  };
  const images = new Map<string, ImageBitmap>();
  const visual = tl.tracks.filter((t) => t.kind !== "audio" && !t.hidden).flatMap((t) => t.clips.filter((c) => !c.text && c.assetId));

  // each video clip: its frames in order, one per output frame it covers (decoded once, front to back)
  interface Stream {
    it: AsyncGenerator<WrappedCanvas | null>;
    idx: number;
    first: number;
    last: number;
    cur: Frame | null;
  }
  const streams = new Map<string, Stream>();
  async function streamOf(c: Clip, a: ExportAsset): Promise<Stream> {
    const had = streams.get(c.id);
    if (had) return had;
    const track = await input(a).getPrimaryVideoTrack();
    if (!track) throw new ExportError("أحد مقاطع الفيديو ما فيه صورة يقدر المتصفح يقرأها.");
    if (!(await track.canDecode())) throw new ExportError("متصفحك ما يقدر يقرأ ترميز أحد مقاطع الفيديو. جرّب Chrome على الكمبيوتر.");
    const first = Math.ceil((c.start * fps) / 1000);
    const last = Math.ceil((clipEnd(c) * fps) / 1000) - 1;
    const times = function* () {
      for (let f = first; f <= last; f++) yield Math.max(0, sourceTime(c, (f * 1000) / fps) / 1000);
    };
    const s: Stream = { it: new CanvasSink(track, { poolSize: 3 }).canvasesAtTimestamps(times()), idx: first - 1, first, last, cur: null };
    streams.set(c.id, s);
    return s;
  }
  /** The clip's frame at its moment `ms` (a transition asks for its first frame early and its last one late). */
  async function frameAt(c: Clip, a: ExportAsset, ms: number) {
    const s = await streamOf(c, a);
    const f = Math.min(s.last, Math.max(s.first, Math.ceil((ms * fps) / 1000 - 1e-6)));
    while (s.idx < f) {
      const n = await s.it.next();
      s.idx++;
      if (n.done) {
        s.idx = s.last;
        break;
      }
      // past the end of its file the clip holds its last frame
      if (n.value) s.cur = { img: n.value.canvas as CanvasImageSource, width: n.value.canvas.width, height: n.value.canvas.height };
    }
    return s.cur;
  }

  // «عزل الشخص»: the segmenter must be ready before the first frame
  const masker = new Masker();
  if (visual.some((c) => c.bg)) {
    await masker.load();
    if (!masker.ready) throw new ExportError("تعذّر تحميل أداة عزل الشخص (تحتاج إنترنت أول مرة). جرّب مرة ثانية.");
  }

  const frames = Math.ceil((total * fps) / 1000);
  let frame = 0;
  try {
    for (const c of visual) {
      const a = byId.get(c.assetId!)!;
      if (a.kind === "image" && !images.has(a.id)) {
        const r = await fetch(a.url!);
        if (!r.ok) throw new ExportError("تعذّر تحميل إحدى الصور.");
        images.set(a.id, await createImageBitmap(await r.blob()));
      }
    }
    await output.start();

    for (let chunk = 0; chunk * CHUNK_S * 1000 < total; chunk++) {
      const from = chunk * CHUNK_S * 1000;
      const to = Math.min(total, from + CHUNK_S * 1000);
      if (audio) await audio.add(await mixChunk(from, to));

      const until = Math.min(frames, Math.ceil((to * fps) / 1000));
      for (; frame < until; frame++) {
        if (signal.aborted) throw new DOMException("cancelled", "AbortError");
        const ms = (frame * 1000) / fps;
        const now = new Map<string, Frame | null>();
        for (const l of layersAt(tl, ms)) {
          if (!("clip" in l) || l.clip.text || !l.clip.assetId) continue;
          const a = byId.get(l.clip.assetId)!;
          let f: Frame | null;
          if (a.kind === "image") {
            const b = images.get(a.id)!;
            f = { img: b, width: b.width, height: b.height };
          } else f = await frameAt(l.clip, a, l.ms);
          if (f && l.clip.bg) f = { ...f, mask: masker.maskOf(l.clip.id, f.img, f.width, f.height) };
          now.set(l.clip.id, f);
        }
        // drawFrame draws in the timeline's units; one scale maps them to the output size
        ctx.setTransform(width / tl.width, 0, 0, height / tl.height, 0, 0);
        drawFrame(ctx, tl, ms, (c) => now.get(c.id) ?? null);
        await video.add(frame / fps, 1 / fps);
        onProgress(frame / frames);
      }
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => {});
    throw err;
  } finally {
    for (const s of streams.values()) await s.it.return(undefined).catch(() => {});
    for (const i of inputs.values()) i.dispose();
    for (const b of images.values()) b.close();
  }
  const buf = (output.target as BufferTarget).buffer;
  if (!buf) throw new ExportError("ما انكتب الملف؛ جرّب مرة ثانية.");
  onProgress(1);
  return { blob: new Blob([buf], { type: "video/mp4" }), width, height, codec: videoCodec, audio: audioCodec, lostSound: audible.length > 0 && !audioCodec };

  /**
   * The mixed sound of [from, to) ms: every audible clip's decoded sound placed at its moment, its loudness following
   * the volume, the fades and the ducking; a faster or slower clip is stretched without changing its pitch.
   */
  async function mixChunk(from: number, to: number) {
    const len = Math.max(1, Math.round(((to - from) / 1000) * SAMPLE_RATE));
    const mix = new OfflineAudioContext(2, len, SAMPLE_RATE);
    for (const { track: tr, c } of audible) {
      const s = Math.max(from, c.start);
      const e = Math.min(to, clipEnd(c));
      if (e <= s) continue;
      const a = byId.get(c.assetId!)!;
      // a clip with sound work: its worked sound (made once, the same the preview plays), from the clip's own start
      const worked = hasSoundFx(c) ? await clipSound(a.url!, c).catch(() => null) : null;
      const base = worked ? c.in / 1000 : 0;
      const track = worked ? null : await input(a).getPrimaryAudioTrack().catch(() => null);
      // WebCodecs when the browser reads this sound; else the whole file through the Web Audio API (Safari + AAC)
      const fast = track ? await track.canDecode().catch(() => false) : false;
      const whole = worked ?? (fast ? null : await decodeWhole(a.url!).catch(() => null));
      if (!fast && !whole) continue;
      const gain = mix.createGain();
      gain.connect(mix.destination);
      // loudness every 20 ms across this piece (fades and ducking are smooth ramps)
      gain.gain.setValueAtTime(gainAt(tr, c, s, spans), (s - from) / 1000);
      for (let t = s + 20; t <= e; t += 20) gain.gain.linearRampToValueAtTime(gainAt(tr, c, Math.min(t, e - 1), spans), (t - from) / 1000);
      const src0 = sourceTime(c, s) / 1000 - base;
      const src1 = sourceTime(c, e) / 1000 - base;
      if (whole) {
        if (c.speed !== 1) {
          const sr = whole.sampleRate;
          const a0 = Math.max(0, Math.floor((src0 - 0.05) * sr));
          const a1 = Math.min(whole.length, Math.ceil((src1 + 0.1) * sr));
          const chs = Array.from({ length: Math.min(2, whole.numberOfChannels) }, (_, ch) => whole.getChannelData(ch).subarray(a0, a1));
          place(mix, gain, chs, sr, Math.round((src0 * sr) - a0), c.speed, s, e, from);
        } else {
          const node = mix.createBufferSource();
          node.buffer = whole;
          node.connect(gain);
          node.start((s - from) / 1000, src0, src1 - src0);
        }
        continue;
      }
      if (c.speed !== 1) {
        await stretched(mix, gain, track!, c, s, e, from, src0, src1);
        continue;
      }
      for await (const wb of new AudioBufferSink(track!).buffers(src0, src1)) {
        const node = mix.createBufferSource();
        node.buffer = wb.buffer;
        node.playbackRate.value = c.speed;
        node.connect(gain);
        // where this piece of sound falls in the chunk, and what of it is outside the clip's part
        const at = (c.start + ((wb.timestamp * 1000 - c.in) / c.speed) - from) / 1000;
        const skip = Math.max(0, src0 - wb.timestamp);
        node.start(Math.max(0, at + skip / c.speed), skip);
        node.stop(Math.max(0, (e - from) / 1000));
      }
    }
    return mix.startRendering();
  }

  async function stretched(mix: OfflineAudioContext, gain: GainNode, track: NonNullable<Awaited<ReturnType<Input["getPrimaryAudioTrack"]>>>, c: Clip, s: number, e: number, from: number, src0: number, src1: number) {
    const parts: AudioBuffer[] = [];
    let t0 = -1;
    for await (const wb of new AudioBufferSink(track).buffers(Math.max(0, src0 - 0.05), src1 + 0.1)) {
      if (t0 < 0) t0 = wb.timestamp;
      parts.push(wb.buffer);
    }
    if (!parts.length) return;
    const sr = parts[0].sampleRate;
    const chs = Math.min(2, parts[0].numberOfChannels);
    const total = parts.reduce((n, b) => n + b.length, 0);
    const input = Array.from({ length: chs }, (_, ch) => {
      const arr = new Float32Array(total);
      let o = 0;
      for (const b of parts) {
        arr.set(b.getChannelData(Math.min(ch, b.numberOfChannels - 1)), o);
        o += b.length;
      }
      return arr;
    });
    place(mix, gain, input, sr, Math.max(0, Math.round((src0 - t0) * sr)), c.speed, s, e, from);
  }

  /** Stretches `channels` from sample `at` to the piece [s, e) and plays it there (pitch kept). */
  function place(mix: OfflineAudioContext, gain: GainNode, channels: Float32Array[], sr: number, at: number, speed: number, s: number, e: number, from: number) {
    const outLen = Math.max(1, Math.round(((e - s) / 1000) * sr));
    const out = stretch(channels, at, speed, outLen);
    const buf = mix.createBuffer(out.length, outLen, sr);
    out.forEach((d, ch) => buf.copyToChannel(d as Float32Array<ArrayBuffer>, ch));
    const node = mix.createBufferSource();
    node.buffer = buf;
    node.connect(gain);
    node.start((s - from) / 1000);
  }
}

let aacReady: Promise<void> | null = null;

/**
 * The sound's codec: the browser's own AAC (or Opus) encoder when it has one, else an AAC encoder that runs in the
 * page (FFmpeg's, as WebAssembly: Safari on iPhone, for one, has none of its own), so the file never comes out silent.
 */
async function soundCodec() {
  const opts = { numberOfChannels: 2, sampleRate: SAMPLE_RATE, quality: QUALITY_HIGH };
  const native = "AudioEncoder" in window ? await getFirstEncodableAudioCodec(["aac", "opus"], opts).catch(() => null) : null;
  if (native) return native;
  aacReady ??= import("@mediabunny/aac-encoder").then((m) => m.registerAacEncoder());
  try {
    await aacReady;
  } catch {
    aacReady = null;
    return null;
  }
  return (await getFirstEncodableAudioCodec(["aac"], opts).catch(() => null)) ?? null;
}

/** Saves the file on the device. */
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".mp4") ? name : `${name}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
