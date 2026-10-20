// «مختبر الموشن» on the person's own video, in the browser: the video read for the scene (one decoder walking
// forward frame by frame while the film renders, and seeking only when the preview or the review jumps), and what the
// lab learns about it before حيدرة plans: what they say with every word's time (ElevenLabs Scribe), where the face is
// as it moves (MediaPipe, here in the browser), a few frames for his eyes, and its sound for the mix.

import { ALL_FORMATS, CanvasSink, Input, UrlSource, type WrappedCanvas } from "mediabunny";
import type { Clip } from "@/lib/editor/model";
import type { FootageFace, FootageMeta, FootageWord } from "@/lib/editor/scene/footage";
import { FOOTAGE_MAX } from "@/lib/editor/scene/footage";
import { extractSound } from "./captions";
import { spokenWords } from "./captions-make";
import { facesIn } from "./face";
import type { EditorAsset } from "./types";
import { postJson } from "@/lib/fetch";
import { checkFootage } from "./footage-check";

export { FootageUnavailable, checkFootage } from "./footage-check";

/** The clip the piece is built on: which file, which part of it, how fast. */
export interface FootageSource {
  clipId: string;
  assetId: string;
  name: string;
  url: string;
  in: number;
  out: number;
  speed: number;
  /** where it sits on the timeline (the finished piece goes there) */
  start: number;
  hasAudio: boolean;
}

export const sourceOf = (c: Clip, a: EditorAsset): FootageSource => ({ clipId: c.id, assetId: a.id, name: a.name, url: a.url!, in: c.in, out: c.out, speed: c.speed || 1, start: c.start, hasAudio: a.hasAudio });
/** The piece's length: the clip as it plays (its speed counted). */
export const footageSeconds = (s: FootageSource) => Math.min(FOOTAGE_MAX, (s.out - s.in) / (s.speed || 1) / 1000);

/** The video's frames for the scene: `at(t)` is the frame of the piece's second t (null past what can be read). */
export class FootageReader {
  private input: Input | null = null;
  private sink: CanvasSink | null = null;
  private it: AsyncGenerator<WrappedCanvas, void, unknown> | null = null;
  private cur: WrappedCanvas | null = null;
  private next: WrappedCanvas | null = null;
  private lock: Promise<unknown> = Promise.resolve();
  w = 0;
  h = 0;

  private constructor(private s: FootageSource) {}

  /** Opens the file; the frames come out no bigger than `maxSide` (the piece's own long side is enough). */
  static async open(s: FootageSource, maxSide: number, alpha = false): Promise<FootageReader> {
    await checkFootage(s.url);
    const r = new FootageReader(s);
    r.input = new Input({ source: new UrlSource(s.url), formats: ALL_FORMATS });
    const track = await r.input.getPrimaryVideoTrack();
    if (!track) throw new Error("الفيديو ما فيه صورة يقدر المتصفح يقرأها.");
    if (!(await track.canDecode())) throw new Error("متصفحك ما يقدر يقرأ ترميز هذا الفيديو. جرّب Chrome على الكمبيوتر.");
    const k = Math.min(1, maxSide / Math.max(track.displayWidth, track.displayHeight));
    r.w = Math.max(2, Math.round(track.displayWidth * k));
    r.h = Math.max(2, Math.round(track.displayHeight * k));
    // four canvases in turn: the frame shown, the next one, and the one being decoded never share one
    // alpha: the person cut out («قص الشخص», VP9 with an alpha channel) keeps its empty places empty
    r.sink = new CanvasSink(track, { width: r.w, height: r.h, fit: "fill", poolSize: 4, alpha });
    return r;
  }

  private async pull() {
    const n = await this.it!.next();
    return n.done ? null : n.value;
  }

  private async seek(ts: number) {
    await this.it?.return();
    this.it = this.sink!.canvases(ts, this.s.out / 1000 + 0.5);
    this.cur = await this.pull();
    this.next = this.cur ? await this.pull() : null;
  }

  /** The frame at the piece's second t, as a picture the scene page can take (smaller for a preview). */
  at(t: number, scale = 1): Promise<ImageBitmap | null> {
    const run = this.lock.then(async () => {
      if (!this.sink) return null;
      const ts = Math.max(this.s.in / 1000, Math.min(this.s.out / 1000 - 1e-3, this.s.in / 1000 + t * this.s.speed));
      // forward by a little: the decoder walks on (the render); a jump back or far ahead: it seeks
      if (!this.it || !this.cur || ts < this.cur.timestamp - 1e-3 || ts > this.cur.timestamp + 2) await this.seek(ts);
      while (this.next && this.next.timestamp <= ts + 1e-4) {
        this.cur = this.next;
        this.next = await this.pull();
      }
      if (!this.cur) return null;
      const w = Math.max(2, Math.round(this.w * Math.min(1, scale))), h = Math.max(2, Math.round(this.h * Math.min(1, scale)));
      return createImageBitmap(this.cur.canvas as HTMLCanvasElement | OffscreenCanvas, w === this.w ? undefined : { resizeWidth: w, resizeHeight: h, resizeQuality: "medium" });
    });
    this.lock = run.catch(() => null);
    return run;
  }

  close() {
    void this.it?.return();
    this.it = null;
    this.sink = null;
    this.input?.dispose();
    this.input = null;
  }
}

/** Everything the lab learns about the video before حيدرة plans on it. */
export interface FootageInfo {
  meta: FootageMeta;
  /** a few frames (JPEG, base64) for حيدرة's eyes */
  frames: string[];
}

/** A step that must never hang the plan: it gives up after `ms` (the lab goes on without it). */
function within<T>(p: Promise<T>, ms: number, why: string): Promise<T> {
  return new Promise<T>((ok, no) => {
    const tm = setTimeout(() => no(new Error(why)), ms);
    p.then((v) => (clearTimeout(tm), ok(v)), (e) => (clearTimeout(tm), no(e)));
  });
}

/** Frames of a clip at these piece seconds, read by the same decoder the render uses (no <video> element). */
async function grab(s: FootageSource, times: number[], side: number): Promise<ImageBitmap[]> {
  const r = await FootageReader.open(s, side);
  try {
    const out: ImageBitmap[] = [];
    for (const t of times) {
      const b = await r.at(t);
      if (b) out.push(b);
    }
    return out;
  } finally {
    r.close();
  }
}

const jpeg64 = async (b: ImageBitmap, height: number) => {
  const k = Math.min(1, height / b.height);
  const c = new OffscreenCanvas(Math.max(1, Math.round(b.width * k)), Math.max(1, Math.round(b.height * k)));
  c.getContext("2d")!.drawImage(b, 0, 0, c.width, c.height);
  const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/jpeg", quality: 0.8 })).arrayBuffer());
  let str = "";
  for (let i = 0; i < buf.length; i += 0x8000) str += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(str);
};

/** What one clip says and where its face is, in that clip's own seconds (from its start as it plays). */
async function learnOne(projectId: string, s: FootageSource, a: EditorAsset, label: string, onStep: (t: string) => void) {
  const seconds = footageSeconds(s);
  const toPiece = (ms: number) => Math.round(((ms - s.in) / s.speed / 1000) * 1000) / 1000;
  let words: FootageWord[] = [];
  if (s.hasAudio) {
    try {
      const heard = await within(spokenWords(projectId, { clip: { id: s.clipId, in: s.in, out: s.out } as Clip, asset: a }, "ar", label, onStep), 4 * 60_000, "الكتابة أخذت وقت طويل");
      words = heard.filter((w) => w.s >= s.in && w.s < s.out).map((w) => ({ w: w.w, s: toPiece(w.s), e: toPiece(Math.min(w.e, s.out)) })).filter((w) => w.s < seconds);
    } catch (e) {
      onStep(`⚠️ ${label}: ما قدرت أكتب الكلام (${e instanceof Error ? e.message : e}) — حيدرة يبني على الصورة.`);
    }
  }
  onStep(`🙂 ${label}: أتتبّع الوجه عشان ما ينقص في أي إطار…`);
  let face: FootageFace[] = [];
  let w = a.width ?? 1080, h = a.height ?? 1920;
  try {
    const n = Math.round(Math.min(60, Math.max(8, seconds * 2)));
    const times = Array.from({ length: n }, (_, i) => ((i + 0.5) * seconds) / n);
    const shots = await within(grab(s, times, 640), 60_000, "قراءة الفيديو أخذت وقت طويل");
    if (shots[0]) [w, h] = [shots[0].width, shots[0].height];
    const found = await within(facesIn(shots), 45_000, "أداة الوجه ما ردّت");
    face = found.flatMap((f, i) => (f ? [{ t: Math.round(times[i] * 1000) / 1000, ...f }] : []));
    shots.forEach((b) => b.close());
    if (!face.length) onStep(`⚠️ ${label}: ما لقيت وجه واضح؛ حيدرة يأطّر من الصور.`);
  } catch (e) {
    onStep(`⚠️ ${label}: ما قدرت أتتبّع الوجه (${e instanceof Error ? e.message : e})؛ حيدرة يأطّر من الصور.`);
  }
  return { seconds, words, face, w, h };
}

/** Several clips joined one after another in the order chosen: what the lab learns about all of them, on one clock. */
export async function prepareFootage(projectId: string, list: FootageSource[], assets: EditorAsset[], onStep: (t: string) => void): Promise<FootageInfo> {
  let at = 0, w = 0, h = 0;
  const words: FootageWord[] = [], face: FootageFace[] = [];
  for (const [i, s] of list.entries()) {
    const a = assets.find((x) => x.id === s.assetId);
    if (!a) throw new Error(`ما لقيت ملف «${s.name}» في مكتبتك.`);
    const one = await learnOne(projectId, s, a, list.length > 1 ? `المقطع ${i + 1} من ${list.length}` : "فيديوك", onStep);
    words.push(...one.words.map((x) => ({ ...x, s: Math.round((x.s + at) * 1000) / 1000, e: Math.round((x.e + at) * 1000) / 1000 })));
    face.push(...one.face.map((f) => ({ ...f, t: Math.round((f.t + at) * 1000) / 1000 })));
    if (!w) [w, h] = [one.w, one.h];
    at += one.seconds;
  }
  onStep("🖼️ ألقط صور من الفيديو لحيدرة…");
  const frames = await footageFrames(list).catch(() => []);
  return { meta: { name: list.map((s) => s.name).join(" + ").slice(0, 120), seconds: Math.round(Math.min(FOOTAGE_MAX, at) * 1000) / 1000, w, h, words, face }, frames };
}

/** The piece's length on several clips: all of them, one after another. */
export const footageTotal = (list: FootageSource[]) => Math.min(FOOTAGE_MAX, list.reduce((a, s) => a + footageSeconds(s), 0));

/** The clips' own sound (the person's voice), each from where its clip starts in the piece, for the mix. */
export async function footageSound(list: FootageSource[]): Promise<{ blob: Blob; at: number }[]> {
  const out: { blob: Blob; at: number }[] = [];
  let at = 0;
  for (const s of list) {
    if (s.hasAudio) {
      try {
        out.push({ blob: (await extractSound(s.url, s.in, s.out)).blob, at });
      } catch {
        /* a clip without readable sound plays silent */
      }
    }
    at += footageSeconds(s);
  }
  return out;
}

/** A few frames of the video(s) for حيدرة's eyes (JPEG, base64), spread over the whole piece. */
export async function footageFrames(list: FootageSource[]): Promise<string[]> {
  const out: string[] = [];
  const per = Math.max(1, Math.ceil(4 / list.length));
  for (const s of list.slice(0, 4)) {
    const secs = footageSeconds(s);
    const shots = await within(grab(s, Array.from({ length: per }, (_, i) => ((i + 0.5) * secs) / per), 720), 45_000, "timeout").catch(() => []);
    for (const b of shots) {
      out.push(await jpeg64(b, 480));
      b.close();
    }
  }
  return out.slice(0, 4);
}

/** Several clips read as one: the frame of the piece's second t comes from the clip playing then. */
export class FootageSet {
  private constructor(
    private readers: FootageReader[],
    private starts: number[],
  ) {}
  get w() {
    return this.readers[0]?.w ?? 0;
  }
  get h() {
    return this.readers[0]?.h ?? 0;
  }
  static async open(list: FootageSource[], maxSide: number, alpha = false): Promise<FootageSet> {
    const readers: FootageReader[] = [], starts: number[] = [];
    let at = 0;
    for (const s of list) {
      readers.push(await FootageReader.open(s, maxSide, alpha));
      starts.push(at);
      at += footageSeconds(s);
    }
    return new FootageSet(readers, starts);
  }
  at(t: number, scale = 1) {
    let i = this.starts.length - 1;
    while (i > 0 && t < this.starts[i]) i--;
    return this.readers[i]?.at(t - this.starts[i], scale) ?? Promise.resolve(null);
  }
  close() {
    this.readers.forEach((r) => r.close());
  }
}

/**
 * «قص الشخص»: the person cut out of the clip's whole file (made once on the server and kept with it), as a link to a
 * WebM with alpha; asked again every few seconds while it is being made. `onStep` hears how long it has been.
 */
export async function footageMatte(projectId: string, assetId: string, onStep: (t: string) => void, signal?: AbortSignal): Promise<string> {
  const started = Date.now();
  for (;;) {
    if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
    const r = await postJson<{ url?: string; pending?: boolean; error?: string }>(`/api/jawad/editor/projects/${projectId}`, { action: "lab_matte", assetId }, signal);
    if (r.error) throw new Error(r.error);
    if (r.url) return r.url;
    if (Date.now() - started > 20 * 60_000) throw new Error("قص الشخص أخذ أكثر من ٢٠ دقيقة؛ جرّب مرة ثانية بعد شوي.");
    onStep(`✂️ أقص الشخص من فيديوك بجودة عالية… ${Math.round((Date.now() - started) / 1000)} ث`);
    await new Promise((ok) => setTimeout(ok, 6000));
  }
}
