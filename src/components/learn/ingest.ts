// The owner's browser makes a lesson: cuts the video into pieces (fragmented MP4 through Mediabunny, the video is copied, not
// re-made when its codec fits MP4), locks each piece with the lesson's key, and uploads it straight to the private bucket.
// Nothing big goes through the site's server and the clear video never leaves the owner's computer.

import { ALL_FORMATS, BlobSource, Conversion, Input, Mp4OutputFormat, Output, StreamTarget, type StreamTargetChunk } from "mediabunny";
import { aad, fromB64, importKey, seal } from "@/lib/learn/crypto";
import { Packager, type Piece } from "@/lib/learn/fmp4";
import { LEARN, manifestProblem, type Manifest, type SegmentInfo } from "@config/learn";

export interface IngestOptions {
  lessonId: string;
  /** the lesson's key (base64) */
  key: string;
  /** signed upload links for these piece numbers */
  sign: (ns: number[]) => Promise<Record<string, string>>;
  onProgress?: (p: number, label: string) => void;
  signal?: AbortSignal;
}

/** The codec string of what was really produced (the init piece + the first fragment read back by Mediabunny). */
async function producedMime(init: Uint8Array, first: Uint8Array): Promise<string> {
  const input = new Input({ source: new BlobSource(new Blob([init as BlobPart, first as BlobPart])), formats: ALL_FORMATS });
  const v = await input.getPrimaryVideoTrack();
  const a = await input.getPrimaryAudioTrack();
  const codecs = (await Promise.all([v?.getCodecParameterString(), a?.getCodecParameterString()])).filter(Boolean);
  if (!v || !codecs.length) throw new Error("ما قدرت أعرف نوع الفيديو.");
  return `video/mp4; codecs="${codecs.join(",")}"`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function ingest(file: File, o: IngestOptions): Promise<Manifest> {
  if (file.size > LEARN.maxFileBytes) throw new Error("الملف أكبر من الحد المسموح.");
  const key = await importKey(fromB64(o.key));
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new Error("هذا الملف ما فيه فيديو، أو صيغته غير مدعومة. استخدم MP4.");
  const total = await input.computeDuration();
  if (!(total > 0)) throw new Error("ما قدرت أعرف مدة الفيديو.");

  // uploads: at most 4 pieces in flight; the remux waits when they are behind (the stream's write() is the brake)
  const urls = new Map<number, string>();
  const need = (n: number) => urls.has(n) ? Promise.resolve() : o.sign(Array.from({ length: 40 }, (_, i) => n + i).filter((x) => !urls.has(x) && x <= 10_000)).then((r) => { for (const [k, v] of Object.entries(r)) urls.set(Number(k), v); });
  const inflight = new Set<Promise<void>>();
  let failure: unknown = null;
  const infos: SegmentInfo[] = [];
  let initPlain: Uint8Array | null = null;
  let initBytes = 0;
  let firstPlain: Uint8Array | null = null;
  const starts: { n: number; start: number; bytes: number }[] = [];

  async function put(n: number, plain: Uint8Array) {
    const sealed = await seal(key, plain, aad("c", o.lessonId, n));
    if (sealed.length > LEARN.maxSegBytes) throw new Error("جزء من الفيديو كبير جدًا؛ قلّل جودة التصدير (مثلًا 1080p) وأعد الرفع.");
    for (let attempt = 0; ; attempt++) {
      try {
        await need(n);
        const res = await fetch(urls.get(n)!, { method: "PUT", body: sealed as BlobPart, headers: { "content-type": "application/octet-stream" }, signal: o.signal });
        if (!res.ok) throw new Error(`رفع الجزء ${n} فشل (${res.status})`);
        break;
      } catch (e) {
        if (o.signal?.aborted || attempt >= 3) throw e;
        urls.delete(n);
        await sleep(1000 * 2 ** attempt);
      }
    }
    if (n === 0) initBytes = sealed.length;
    else starts.find((s) => s.n === n)!.bytes = sealed.length;
  }

  async function submit(n: number, plain: Uint8Array) {
    while (inflight.size >= 4) await Promise.race(inflight);
    if (failure) throw failure;
    const p: Promise<void> = put(n, plain).catch((e) => { failure ??= e; }).finally(() => inflight.delete(p));
    inflight.add(p);
  }

  const packager = new Packager();
  const writable = new WritableStream<StreamTargetChunk>({
    async write(chunk) {
      const pieces: Piece[] = packager.push(chunk.data);
      for (const p of pieces) {
        if (p.kind === "init") {
          initPlain = p.bytes;
          await submit(0, p.bytes);
        } else {
          starts.push({ n: p.n, start: p.start, bytes: 0 });
          firstPlain ??= p.bytes;
          await submit(p.n, p.bytes);
        }
      }
    },
  });

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "fragmented", minimumFragmentDuration: LEARN.segSeconds }), target: new StreamTarget(writable) });
  const conv = await Conversion.init({ input, output, tracks: "primary" });
  if (!conv.isValid) throw new Error("صيغة هذا الفيديو غير مدعومة. صدّره بصيغة MP4 (H.264) وأعد الرفع.");
  conv.onProgress = (p) => o.onProgress?.(Math.min(0.99, p), "يقطّع ويقفل ويرفع…");
  o.signal?.addEventListener("abort", () => void conv.cancel(), { once: true });
  await conv.execute();
  await Promise.all(inflight);
  if (failure) throw failure;
  if (!packager.clean || !initPlain || !firstPlain || !starts.length) throw new Error("ما انتهى تقطيع الفيديو بشكل سليم.");

  const mime = await producedMime(initPlain, firstPlain);
  if (typeof MediaSource !== "undefined" && !MediaSource.isTypeSupported(mime)) throw new Error(`هذا المتصفح ما يشغّل هذي الصيغة (${mime}). صدّر الفيديو بصيغة MP4 (H.264 + AAC).`);
  // each piece lasts until the next one starts; the last until the end
  starts.sort((a, b) => a.n - b.n);
  starts.forEach((s, i) => infos.push({ n: s.n, start: s.start, dur: (i + 1 < starts.length ? starts[i + 1].start : Math.max(total, s.start + 0.5)) - s.start, bytes: s.bytes }));
  const manifest: Manifest = { mime, duration: Math.max(total, infos[infos.length - 1].start + infos[infos.length - 1].dur), initBytes, segments: infos };
  const problem = manifestProblem(manifest);
  if (problem) throw new Error(problem);
  o.onProgress?.(1, "تم الرفع");
  return manifest;
}
