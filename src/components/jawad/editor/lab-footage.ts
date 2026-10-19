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
import { faceTrack } from "./face";
import { framesOf } from "./media";
import type { EditorAsset } from "./types";

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
  static async open(s: FootageSource, maxSide: number): Promise<FootageReader> {
    const r = new FootageReader(s);
    r.input = new Input({ source: new UrlSource(s.url), formats: ALL_FORMATS });
    const track = await r.input.getPrimaryVideoTrack();
    if (!track) throw new Error("الفيديو ما فيه صورة يقدر المتصفح يقرأها.");
    if (!(await track.canDecode())) throw new Error("متصفحك ما يقدر يقرأ ترميز هذا الفيديو. جرّب Chrome على الكمبيوتر.");
    const k = Math.min(1, maxSide / Math.max(track.displayWidth, track.displayHeight));
    r.w = Math.max(2, Math.round(track.displayWidth * k));
    r.h = Math.max(2, Math.round(track.displayHeight * k));
    // four canvases in turn: the frame shown, the next one, and the one being decoded never share one
    r.sink = new CanvasSink(track, { width: r.w, height: r.h, fit: "fill", poolSize: 4 });
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

export async function prepareFootage(projectId: string, s: FootageSource, a: EditorAsset, onStep: (t: string) => void): Promise<FootageInfo> {
  const seconds = footageSeconds(s);
  const toPiece = (ms: number) => Math.round(((ms - s.in) / s.speed / 1000) * 1000) / 1000;
  let words: FootageWord[] = [];
  if (s.hasAudio) {
    try {
      const heard = await spokenWords(projectId, { clip: { id: s.clipId, in: s.in, out: s.out } as Clip, asset: a }, "ar", "فيديوك", onStep);
      words = heard.filter((w) => w.s >= s.in && w.s < s.out).map((w) => ({ w: w.w, s: toPiece(w.s), e: toPiece(Math.min(w.e, s.out)) })).filter((w) => w.s < seconds);
    } catch (e) {
      onStep(`⚠️ ما قدرت أكتب كلامك (${e instanceof Error ? e.message : e}) — حيدرة يبني على الصورة.`);
    }
  }
  onStep("🙂 أتتبّع وجهك في الفيديو عشان ما ينقص في أي إطار…");
  let face: FootageFace[] = [];
  let w = a.width ?? 1080, h = a.height ?? 1920;
  try {
    const tr = await faceTrack(s.url, s.in, s.out, Math.round(Math.min(40, Math.max(6, seconds / 1.5))));
    face = tr.samples.map((x) => ({ t: toPiece(x.ms), ...x.face }));
    if (tr.width && tr.height) [w, h] = [tr.width, tr.height];
  } catch {
    onStep("⚠️ ما قدرت أتتبّع الوجه؛ حيدرة يأطّر من الصور.");
  }
  onStep("🖼️ ألقط صور من الفيديو لحيدرة…");
  const frames = await footageFrames(s);
  return { meta: { name: s.name, seconds: Math.round(seconds * 1000) / 1000, w, h, words, face }, frames };
}

/** The video's own sound (the person's voice), for the piece's mix. */
export async function footageSound(s: FootageSource): Promise<Blob | null> {
  if (!s.hasAudio) return null;
  try {
    return (await extractSound(s.url, s.in, s.out)).blob;
  } catch {
    return null;
  }
}

/** A few frames of the video for حيدرة's eyes (JPEG, base64), when what was learnt about it is already kept. */
export async function footageFrames(s: FootageSource): Promise<string[]> {
  return (await framesOf(s.url, "video", s.in, s.out, 4, 480).catch(() => [])).map((f) => f.data);
}
