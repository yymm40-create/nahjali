// «الممنتج الذكي» — the browser side of captions: the clip's sound cut out and compressed (only what is heard is sent),
// spoken words grouped into short phrases on the timeline, poem verses kept one per caption, and SRT files in and out.

import { ALL_FORMATS, AudioBufferSink, AudioBufferSource, BufferTarget, canEncodeAudio, Input, Output, UrlSource, WebMOutputFormat } from "mediabunny";
import { clipEnd, formatTime, type Clip, type Timeline, type Word } from "@/lib/editor/model";

export interface SpokenWord {
  s: number;
  e: number;
  w: string;
}
export interface CaptionItem {
  start: number;
  end: number;
  body: string;
  words?: Word[];
}

const CHUNK_S = 20;

/** Renders `[from, to)` seconds of a track as mono sound at `rate` (one short piece at a time). */
async function* pieces(track: NonNullable<Awaited<ReturnType<Input["getPrimaryAudioTrack"]>>>, from: number, to: number, rate: number) {
  for (let cs = from; cs < to; cs += CHUNK_S) {
    const ce = Math.min(to, cs + CHUNK_S);
    const ctx = new OfflineAudioContext(1, Math.max(1, Math.round((ce - cs) * rate)), rate);
    for await (const wb of new AudioBufferSink(track).buffers(cs, ce)) {
      const node = ctx.createBufferSource();
      node.buffer = wb.buffer;
      node.connect(ctx.destination);
      const skip = Math.max(0, cs - wb.timestamp);
      node.start(Math.max(0, wb.timestamp - cs), skip);
    }
    yield await ctx.startRendering();
  }
}

/**
 * The sound of a file from `fromMs` to `toMs`, small enough to send: Opus in WebM (about 4 KB a second) where the
 * browser can encode it, else 16 kHz WAV.
 */
export async function extractSound(url: string, fromMs: number, toMs: number, onProgress?: (p: number) => void): Promise<{ blob: Blob; format: "webm" | "wav" }> {
  const input = new Input({ source: new UrlSource(url), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track) throw new Error("هذا المقطع ما فيه صوت.");
    if (!(await track.canDecode())) throw new Error("متصفحك ما يقدر يقرأ صوت هذا المقطع.");
    const from = fromMs / 1000;
    const to = toMs / 1000;
    const opus = "AudioEncoder" in window && (await canEncodeAudio("opus", { numberOfChannels: 1, sampleRate: 48000 }).catch(() => false));
    if (opus) {
      const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() });
      const src = new AudioBufferSource({ codec: "opus", bitrate: 32_000 });
      output.addAudioTrack(src);
      await output.start();
      let done = 0;
      for await (const b of pieces(track, from, to, 48000)) {
        await src.add(b);
        done += b.length / 48000;
        onProgress?.(Math.min(1, done / Math.max(0.1, to - from)));
      }
      await output.finalize();
      return { blob: new Blob([(output.target as BufferTarget).buffer!], { type: "audio/webm" }), format: "webm" };
    }
    const rate = 16000;
    const parts: Int16Array[] = [];
    for await (const b of pieces(track, from, to, rate)) {
      const d = b.getChannelData(0);
      const pcm = new Int16Array(d.length);
      for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 0x7fff;
      parts.push(pcm);
    }
    return { blob: wav(parts, rate), format: "wav" };
  } finally {
    input.dispose();
  }
}

function wav(parts: Int16Array[], rate: number) {
  const n = parts.reduce((m, p) => m + p.length, 0);
  const head = new DataView(new ArrayBuffer(44));
  const str = (o: number, s: string) => [...s].forEach((c, i) => head.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  head.setUint32(4, 36 + n * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  head.setUint32(16, 16, true);
  head.setUint16(20, 1, true);
  head.setUint16(22, 1, true);
  head.setUint32(24, rate, true);
  head.setUint32(28, rate * 2, true);
  head.setUint16(32, 2, true);
  head.setUint16(34, 16, true);
  str(36, "data");
  head.setUint32(40, n * 2, true);
  return new Blob([head.buffer, ...parts.map((p) => p.buffer as ArrayBuffer)], { type: "audio/wav" });
}

/** A file's words (source ms) placed where its clip plays them on the timeline (outside the clip's part: dropped). */
export function onTimeline(c: Clip, words: SpokenWord[]): SpokenWord[] {
  return words
    .filter((w) => w.s >= c.in && w.s < c.out)
    .map((w) => ({ s: Math.round(c.start + (w.s - c.in) / c.speed), e: Math.round(c.start + (Math.min(w.e, c.out) - c.in) / c.speed), w: w.w }))
    .filter((w) => w.s < clipEnd(c));
}

const ENDS = /[.!?؟،,؛;:…]$/;

/** Spoken words (timeline ms) as short caption phrases: a few words, a pause or the end of a sentence starts a new one. */
export function phrases(words: SpokenWord[], maxWords: number): CaptionItem[] {
  const out: CaptionItem[] = [];
  let cur: SpokenWord[] = [];
  const flush = () => {
    if (!cur.length) return;
    const start = cur[0].s;
    out.push({ start, end: Math.max(cur[cur.length - 1].e, start + 400), body: cur.map((w) => w.w).join(" "), words: cur.map((w) => ({ s: w.s - start, e: w.e - start, w: w.w })) });
    cur = [];
  };
  for (const w of [...words].sort((a, b) => a.s - b.s)) {
    const last = cur[cur.length - 1];
    if (cur.length && (cur.length >= maxWords || w.s - last.e > 700 || w.e - cur[0].s > 3500)) flush();
    cur.push(w);
    if (ENDS.test(w.w)) flush();
  }
  flush();
  // a short silence between two phrases is bridged, so captions don't blink
  for (let i = 0; i + 1 < out.length; i++) if (out[i + 1].start - out[i].end < 300) out[i].end = out[i + 1].start;
  return out;
}

/** A poem: each verse (line of the text) is one caption, its words timed by the alignment (in order). */
export function verses(text: string, words: SpokenWord[]): CaptionItem[] | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const counts = lines.map((l) => l.split(/\s+/).filter(Boolean).length);
  if (counts.reduce((a, b) => a + b, 0) !== words.length) return null;
  const out: CaptionItem[] = [];
  let k = 0;
  lines.forEach((line, i) => {
    const ws = words.slice(k, k + counts[i]);
    k += counts[i];
    if (!ws.length) return;
    const start = ws[0].s;
    out.push({ start, end: Math.max(ws[ws.length - 1].e + 250, start + 400), body: line, words: ws.map((w, j) => ({ s: w.s - start, e: w.e - start, w: line.split(/\s+/).filter(Boolean)[j] ?? w.w })) });
  });
  for (let i = 0; i + 1 < out.length; i++) if (out[i].end > out[i + 1].start) out[i].end = out[i + 1].start;
  return out;
}

// ---------- SRT ----------

const srtTime = (ms: number) => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const r = Math.floor(ms % 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

/** Every text clip of the text tracks (or of one track) as an SRT subtitle file. */
export function toSRT(tl: Timeline, trackId?: string) {
  const clips = tl.tracks
    .filter((t) => t.kind === "text" && (!trackId || t.id === trackId))
    .flatMap((t) => t.clips.filter((c) => c.text?.body.trim()))
    .sort((a, b) => a.start - b.start);
  return clips.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(clipEnd(c))}\n${c.text!.body.trim()}\n`).join("\n");
}

/** An SRT (or WebVTT) file's subtitles as caption phrases. */
export function parseSRT(src: string): CaptionItem[] {
  const t = (v: string) => {
    const m = v.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})/);
    if (!m) return NaN;
    return (Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000 + Number(m[4].padEnd(3, "0"));
  };
  const out: CaptionItem[] = [];
  for (const block of src.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = block.split("\n").filter((l) => l.trim());
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, b] = lines[i].split("-->");
    const start = t(a);
    const end = t(b);
    const body = lines.slice(i + 1).join("\n").replace(/<[^>]+>/g, "").trim();
    if (Number.isFinite(start) && Number.isFinite(end) && end > start && body) out.push({ start, end, body });
  }
  return out.slice(0, 3000);
}

export const describe = (items: CaptionItem[]) => (items.length ? `${items.length} جملة من ${formatTime(items[0].start, false)} إلى ${formatTime(items[items.length - 1].end, false)}` : "");
