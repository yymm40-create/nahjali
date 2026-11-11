// «Claude Code» in the image studio, in the browser: the picture's program is written on the server, rendered HERE in
// the motion lab's sandboxed scene page at full size, looked at by Claude (a smaller JPEG), rewritten while it is below
// the bar, and the final PNG is kept as a work of «أعمالي». A program that throws goes back to be fixed first.

import { postJson } from "@/lib/fetch";
import { CODE_FIXES, CODE_ROUNDS } from "@/lib/claude-code/skill";
import { SceneHost, SceneError, sceneFont, type SceneInfo } from "@/components/jawad/editor/scene-host";
import { canExport, probe, renderVideo, sheetAt } from "@/components/jawad/editor/scene-render";
import { mixSoundtrack } from "@/components/jawad/editor/lab-sound";
import { readCues } from "@/lib/editor/scene/contract";
import { pictureSize } from "@/lib/claude-code/picture-rubric";
import { putWithProgress } from "@/components/jawad/studio/upload";

const URL = "/api/jawad/claude-code";

export interface DrawStep {
  text: string;
  /** the picture as it is now (an object URL), when there is one */
  preview?: string;
}
export interface DrawResult {
  png: string;
  scores: Record<string, number>;
  pass: boolean;
  verdict: string;
  rounds: number;
  coins: number;
  /** the program the picture was drawn from (a single drawing only), for a later change to be a patch on it */
  program?: { code: string; fonts: { head: string; body: string }; size: [number, number] };
  /** the picture is a CHANGE patched onto the program of a picture drawn before (the edit path took) */
  edited?: boolean;
  /** a motion slide: its MP4, with its sound (`png` is its last frame) */
  video?: Blob;
}

/** A motion carousel's slide: drawn as a moving scene, its frames reviewed, then rendered to MP4 here with its sound. */
export interface DrawMotion {
  n: number;
  seconds: number;
  style: string;
  first: boolean;
  total: number;
  /** the library's sound effects (id → link), for the scene's cues */
  sfx?: Record<string, string>;
}

/**
 * A CHANGE to a picture drawn before (opt-in, «المصمم الذكي»): its program, the brief it was drawn from and the person's
 * words. The program gets EDITS instead of being written again; when they can't be applied or the result throws, the
 * picture is drawn from zero once.
 */
export interface DrawEdit {
  code: string;
  fonts: { head: string; body: string };
  brief: string;
  said: string;
  photosChanged: boolean;
}

async function bitmapTo(bm: ImageBitmap, type: "image/png" | "image/jpeg", maxSide?: number, quality = 0.86) {
  const k = maxSide ? Math.min(1, maxSide / Math.max(bm.width, bm.height)) : 1;
  const c = document.createElement("canvas");
  c.width = Math.round(bm.width * k);
  c.height = Math.round(bm.height * k);
  c.getContext("2d")!.drawImage(bm, 0, 0, c.width, c.height);
  const url = c.toDataURL(type, quality);
  return url.split(",")[1];
}

/** Photos placed in one drawing; more are added in a second round on top of the first (owner's decision). */
export const PHOTOS_PER_ROUND = 10;
/** Photos in all (two rounds). */
export const PHOTOS_MAX = PHOTOS_PER_ROUND * 2;

/** A photo to PLACE in the picture, at full size for the scene (long side up to `side`), or null when it can't be read. */
async function photoBitmap(url: string, side: number): Promise<ImageBitmap | null> {
  try {
    const bm = await createImageBitmap(await (await fetch(url)).blob());
    const k = Math.min(1, side / Math.max(bm.width, bm.height));
    if (k >= 1) return bm;
    const out = await createImageBitmap(bm, { resizeWidth: Math.round(bm.width * k), resizeHeight: Math.round(bm.height * k), resizeQuality: "high" });
    bm.close();
    return out;
  } catch {
    return null;
  }
}

/**
 * A READY design («كاظم»'s majlis designs): its exact program, written by the site from the template the person picked.
 * The page draws it as it is (the photos placed in its frames, the words in their places) — nothing is rewritten.
 */
export interface DrawTemplate {
  code: string;
  fonts: { head: string; body: string };
  /** more fonts of the catalogue the program reads as K.fonts.<role> */
  extra?: Record<string, string>;
  /** the people's photos (photo numbers) and the shape (width ÷ height) of the frame each goes in: each is cut around
   * his face first — the whole face with the hair, then as much of the chest as the frame holds (the owner's rule) */
  faces?: { photo: number; aspect: number; place?: number[]; cut?: boolean }[];
}

/** A cut-out with clear room around it, so the frame's crop around his face is never squeezed by the cut-out's edges. */
function padded(bm: ImageBitmap): ImageBitmap {
  const c = new OffscreenCanvas(Math.round(bm.width * 2), Math.round(bm.height * 1.6));
  c.getContext("2d")!.drawImage(bm, Math.round(bm.width * 0.5), Math.round(bm.height * 0.3));
  bm.close();
  return c.transferToImageBitmap();
}

/** A cut-out's edge made clean: the hard, stair-stepped border softened by a hair, the stray specks around it gone. */
function cleanEdge(bm: ImageBitmap): ImageBitmap {
  const c = new OffscreenCanvas(bm.width, bm.height);
  const x = c.getContext("2d")!;
  x.drawImage(bm, 0, 0);
  const m = new OffscreenCanvas(bm.width, bm.height);
  const mx = m.getContext("2d")!;
  // the alpha slightly shrunk (specks and fringe gone), then softened
  mx.filter = `blur(${Math.max(1, Math.round(bm.width / 1400))}px)`;
  mx.drawImage(bm, 0, 0);
  mx.filter = "none";
  x.globalCompositeOperation = "destination-in";
  x.drawImage(m, 0, 0);
  x.drawImage(m, 0, 0);
  return c.transferToImageBitmap();
}

/**
 * A person cut out of his photo (transparent around him), put on a clear picture of the whole frame with his face at
 * `place` (x, y, w, h fractions: where the man's face was in the design) — the same size and the same spot.
 */
async function placeByFace(bm: ImageBitmap, place: number[], W: number, H: number, cut: boolean): Promise<ImageBitmap> {
  const { faceInPicture } = await import("@/components/jawad/editor/face");
  const f = await faceInPicture(bm);
  const [fx, fy, fw, fh] = place;
  const c = new OffscreenCanvas(W, H);
  const x = c.getContext("2d")!;
  if (f && !cut) {
    // the photo kept with its background: the face, the hair and the chest, its edges fading into the design
    const k = (fw * W) / f.w;
    const cx = (fx + fw / 2) * W, cy = (fy + fh / 2) * H;
    const sw = f.w * 3.2, sh = f.h * 4.2, sx = f.x + f.w / 2 - sw / 2, sy = f.y - f.h * 0.9;
    const dx = cx - (f.x + f.w / 2 - sx) * k, dy = cy - (f.y + f.h / 2 - sy) * k, dw = sw * k, dh = sh * k;
    x.drawImage(bm, sx, sy, sw, sh, dx, dy, dw, dh);
    const g = x.createRadialGradient(dx + dw / 2, dy + dh * 0.42, Math.min(dw, dh) * 0.3, dx + dw / 2, dy + dh * 0.5, Math.max(dw, dh) * 0.55);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.globalCompositeOperation = "destination-in";
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  } else if (f) {
    const k = (fw * W) / f.w;
    const cx = (fx + fw / 2) * W, cy = (fy + fh / 2) * H;
    x.drawImage(bm, cx - (f.x + f.w / 2) * k, cy - (f.y + f.h / 2) * k, bm.width * k, bm.height * k);
  } else {
    // no face found: the person's top at the man's head, his width about three faces
    const k = (fw * W * 3) / bm.width;
    x.drawImage(bm, (fx + fw / 2) * W - (bm.width * k) / 2, (fy - fh * 0.4) * H, bm.width * k, bm.height * k);
  }
  bm.close();
  return c.transferToImageBitmap();
}

/** A person's photo cut for his frame: the face whole with its hair at the top, the chest under it as far as it goes. */
async function aroundFace(bm: ImageBitmap, aspect: number): Promise<ImageBitmap> {
  const { faceInPicture } = await import("@/components/jawad/editor/face");
  const f = await faceInPicture(bm);
  const W = bm.width, H = bm.height;
  let cw: number, ch: number, cx: number, top: number;
  if (f) {
    cw = f.w * 2.5;
    ch = cw / aspect;
    // never shorter than the face with its hair and chin
    if (ch < f.h * 1.9) { ch = f.h * 1.9; cw = ch * aspect; }
    cx = f.x + f.w / 2;
    top = f.y - f.h * 0.55;
  } else {
    // no face found: the upper part of the picture
    cw = W;
    ch = cw / aspect;
    cx = W / 2;
    top = 0;
  }
  const k = Math.min(1, W / cw, H / ch);
  cw *= k;
  ch *= k;
  const x = Math.max(0, Math.min(W - cw, cx - cw / 2));
  const y = Math.max(0, Math.min(H - ch, top));
  if (x <= 0 && y <= 0 && cw >= W - 1 && ch >= H - 1) return bm;
  const out = await createImageBitmap(bm, Math.round(x), Math.round(y), Math.round(cw), Math.round(ch));
  bm.close();
  return out;
}

type DrawOptions = { prompt: string; aspect: string; style: string; references: string[]; photos?: string[]; model: string; signal?: AbortSignal; onStep: (s: DrawStep) => void; from?: "studio" | "designer" | "content"; edit?: DrawEdit | null; motion?: DrawMotion | null; template?: DrawTemplate | null };

/**
 * Draws the picture by program, with up to CODE_ROUNDS looks and rewrites. `photos` are the person's pictures to PUT IN
 * the picture as they are (a speaker's photo, a logo): handed to the scene as photo1…photo10 and shown to Claude. More
 * than ten (up to twenty) are placed in a SECOND drawing whose base is the first picture.
 */
export async function drawWithCode(o: DrawOptions): Promise<DrawResult> {
  if (o.motion) return drawMotion(o, o.motion);
  if (o.template) return drawTemplate(o, o.template);
  const all = (o.photos ?? []).slice(0, PHOTOS_MAX);
  if (o.edit && all.length <= PHOTOS_PER_ROUND) {
    const tried = await drawEdit({ ...o, photos: all }, o.edit);
    if (tried.result) return tried.result;
    // the patch did not take: the whole program, from zero, once
    o.onStep({ text: "التعديل ما ركب على البرنامج — حيدرا ماكس يرسم التصميم من جديد…" });
    const whole = await drawOnce({ ...o, photos: all });
    return { ...whole, coins: whole.coins + tried.coins };
  }
  if (all.length <= PHOTOS_PER_ROUND) return drawOnce({ ...o, photos: all });
  const first = await drawOnce({ ...o, photos: all.slice(0, PHOTOS_PER_ROUND), onStep: (s) => o.onStep({ ...s, text: `الجولة ١ من ٢ (أول ${PHOTOS_PER_ROUND} صور) — ${s.text}` }) });
  const rest = all.slice(PHOTOS_PER_ROUND);
  const second = await drawOnce({
    ...o,
    prompt: `${o.prompt}

SECOND ROUND: photo1 is the design as it stands after the first round (its first ${PHOTOS_PER_ROUND} photos already placed): draw it as the base filling the whole frame, change nothing in it, and add the remaining ${rest.length} photo${rest.length > 1 ? "s" : ""} (photo2…photo${rest.length + 1}) where the request says, in the same style, without covering a face or a word that is already there.`,
    references: [],
    photos: [`data:image/png;base64,${first.png}`, ...rest],
    onStep: (s) => o.onStep({ ...s, text: `الجولة ٢ من ٢ (الصور الباقية) — ${s.text}` }),
  });
  // the second drawing's program places the first picture, which is not kept: no program to patch later
  return { ...second, program: undefined, rounds: first.rounds + second.rounds, coins: first.coins + second.coins };
}

/** A ready design: its program drawn at full size, as it is. */
async function drawTemplate(o: DrawOptions, t: DrawTemplate): Promise<DrawResult> {
  const list = o.photos ?? [];
  o.onStep({ text: t.faces?.some((f) => f.cut) ? "✂️ حيدرا ماكس فرّغ خلفية الصور باحتراف — يحط الأشخاص في التصميم اللي اخترته…" : "🧑‍💻 حيدرا ماكس يجهّز التصميم اللي اخترته بصورك وكلامك…" });
  const bms = await Promise.all(list.map((url) => photoBitmap(url, 2400)));
  const missing = bms.findIndex((b) => !b);
  if (missing >= 0) {
    for (const b of bms) b?.close();
    throw new Error(missing === 0 ? "ما قدرنا نحمّل التصميم المختار؛ جرّب مرة ثانية." : "ما قدرنا نحمّل إحدى الصور؛ ارفعها مرة ثانية.");
  }
  const [W, H] = pictureSize(o.aspect);
  for (const f of t.faces ?? []) {
    const i = f.photo - 1;
    if (!bms[i]) continue;
    // the person's choice: cut out (his edge cleaned) or with his own background
    const pic = f.cut ? cleanEdge(bms[i]!) : bms[i]!;
    if (pic !== bms[i]) bms[i]!.close();
    bms[i] = f.place ? await placeByFace(pic, f.place, W, H, !!f.cut) : await aroundFace(f.cut ? padded(pic) : pic, f.aspect);
  }
  const assets = bms.map((bm, i) => ({ id: `photo${i + 1}`, bitmap: bm! }));
  const fonts = [...sceneFonts(t.fonts), ...Object.entries(t.extra ?? {}).map(([role, id]) => sceneFont(role, id)).filter((f): f is NonNullable<typeof f> => !!f)];
  const host = new SceneHost();
  try {
    o.onStep({ text: "أرسم التصميم…" });
    await host.load(t.code, { w: W, h: H, assets, fonts });
    const bm = await host.frame(0);
    const png = await bitmapTo(bm, "image/png");
    const still = await bitmapTo(bm, "image/jpeg", 1280, 0.85);
    bm.close();
    o.onStep({ text: "✅ التصميم جاهز.", preview: `data:image/jpeg;base64,${still}` });
    return { png, scores: {}, pass: true, verdict: "", rounds: 1, coins: 0, program: { code: t.code, fonts: t.fonts, size: [W, H] } };
  } finally {
    host.destroy();
    for (const a of assets) a.bitmap.close();
  }
}

type Wrote = { code: string; problems: string[]; fonts: { head: string; body: string }; size: [number, number]; notes: string; coins: number; patchFailed?: string };
type Reviewed = { review: { scores: Record<string, number>; pass: boolean; verdict: string }; code: string; problems: string[]; coins: number };

/** The photos to place, loaded for the scene (full size) and for Claude's eyes (small JPEGs), and the server call. */
async function prepare(o: DrawOptions) {
  const list = o.photos ?? [];
  // many photos: a little smaller each, so ten full pictures fit a phone's memory
  const side = list.length > 4 ? 1600 : 2048;
  const loaded = (await Promise.all(list.map(async (url) => ({ bm: await photoBitmap(url, side), small: await smallJpeg(url) })))).filter((p): p is { bm: ImageBitmap; small: string } => !!p.bm && !!p.small);
  const assets = loaded.map((p, i) => ({ id: `photo${i + 1}`, bitmap: p.bm }));
  const photos = loaded.map((p) => p.small);
  const motion = o.motion ? { n: o.motion.n, motion: { seconds: o.motion.seconds, style: o.motion.style, first: o.motion.first, total: o.motion.total } } : {};
  const call = <T>(body: Record<string, unknown>) => postJson<T>(URL, { model: o.model, prompt: o.prompt, aspect: o.aspect, style: o.style, references: o.references, photos, from: o.from ?? "studio", ...motion, ...body }, o.signal);
  return { assets, call };
}

const sceneFonts = (fonts: { head: string; body: string }) => [sceneFont("head", fonts.head), sceneFont("body", fonts.body)].filter((f): f is NonNullable<typeof f> => !!f);

/**
 * The CHANGE path: EDITS on the program of the picture drawn before (a few hundred tokens, not a program from zero),
 * rendered, then looked at ONCE — a fix below the bar comes back as edits too. `result` null (with what was spent) when
 * the patch can't be applied or the patched program throws: the caller draws from zero.
 */
async function drawEdit(o: DrawOptions, e: DrawEdit): Promise<{ result: DrawResult | null; coins: number }> {
  const { assets, call } = await prepare(o);
  let coins = 0;
  const host = new SceneHost();
  try {
    if (o.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الرسم."), { name: "AbortError" });
    o.onStep({ text: "✏️ حيدرا ماكس يعدّل برنامج التصميم نفسه (بدون رسم من الصفر)…" });
    const w = await call<Wrote>({ action: "write", edit: true, code: e.code, fonts: e.fonts, brief: e.brief, said: e.said, photosChanged: e.photosChanged });
    coins += w.coins ?? 0;
    if (w.patchFailed || !w.code || w.problems?.length) return { result: null, coins };
    const [W, H] = w.size;
    const fonts = sceneFonts(w.fonts);
    const draw = async (code: string) => {
      if (o.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الرسم."), { name: "AbortError" });
      await host.load(code, { w: W, h: H, assets, fonts });
      return host.frame(0);
    };
    let code = w.code;
    let bm: ImageBitmap;
    try {
      o.onStep({ text: "أرسم التصميم بعد التعديل…" });
      bm = await draw(code);
    } catch (err) {
      if (err instanceof SceneError) return { result: null, coins };
      throw err;
    }
    let png = await bitmapTo(bm, "image/png");
    const still = await bitmapTo(bm, "image/jpeg", 1280, 0.85);
    bm.close();
    o.onStep({ text: "حيدرا ماكس يشوف التصميم بعد التعديل ويقيّمه…", preview: `data:image/jpeg;base64,${still}` });
    const r = await call<Reviewed>({ action: "review", code, still, round: 1, patch: true });
    coins += r.coins ?? 0;
    if (!r.review.pass && r.code && !r.problems?.length) {
      o.onStep({ text: "حيدرا ماكس يصلّح اللي شافه…" });
      try {
        const fixed = await draw(r.code);
        png = await bitmapTo(fixed, "image/png");
        fixed.close();
        code = r.code;
      } catch (err) {
        // the fix threw: the picture before it stands
        if (!(err instanceof SceneError)) throw err;
      }
    }
    return { result: { png, scores: r.review.scores, pass: r.review.pass, verdict: r.review.verdict, rounds: 1, coins, program: { code, fonts: w.fonts, size: [W, H] }, edited: true }, coins };
  } finally {
    host.destroy();
    for (const a of assets) a.bitmap.close();
  }
}

async function drawOnce(o: DrawOptions): Promise<DrawResult> {
  const { assets, call } = await prepare(o);
  let coins = 0;
  o.onStep({ text: "🧑‍💻 حيدرا ماكس يكتب برنامج الصورة…" });
  let w = await call<Wrote>({ action: "write" });
  coins += w.coins ?? 0;
  let code = w.code;
  let problems = w.problems;
  const fonts = w.fonts;
  const [W, H] = w.size;
  const host = new SceneHost();
  try {
    let best: DrawResult | null = null;
    for (let round = 1; round <= CODE_ROUNDS; round++) {
      let bm: ImageBitmap | null = null;
      for (let fix = 0; ; fix++) {
        if (o.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الرسم."), { name: "AbortError" });
        try {
          if (problems.length) throw new SceneError(problems.join("; "), "check");
          o.onStep({ text: `أرسم الصورة من البرنامج${round > 1 ? ` (جولة ${round})` : ""}…` });
          await host.load(code, { w: W, h: H, assets, fonts: sceneFonts(fonts) });
          bm = await host.frame(0);
          break;
        } catch (e) {
          if (!(e instanceof SceneError) || fix >= CODE_FIXES) throw e instanceof SceneError ? new Error(`برنامج الصورة ما اشتغل بعد ${fix + 1} محاولات: ${e.message}`) : e;
          o.onStep({ text: "البرنامج طلع فيه خطأ — حيدرا ماكس يصلّحه…" });
          w = await call<Wrote>({ action: "write", code, errors: `${e.where}: ${e.message}\n${e.stack2}` });
          coins += w.coins ?? 0;
          code = w.code;
          problems = w.problems;
        }
      }
      const png = await bitmapTo(bm, "image/png");
      const still = await bitmapTo(bm, "image/jpeg", 1280, 0.85);
      bm.close();
      o.onStep({ text: `حيدرا ماكس يشوف الصورة ويقيّمها (جولة ${round} من ${CODE_ROUNDS})…`, preview: `data:image/jpeg;base64,${still}` });
      const r = await call<Reviewed>({ action: "review", code, still, round });
      coins += r.coins ?? 0;
      best = { png, scores: r.review.scores, pass: r.review.pass, verdict: r.review.verdict, rounds: round, coins, program: { code, fonts, size: [W, H] } };
      if (r.review.pass || !r.code) break;
      code = r.code;
      problems = r.problems;
    }
    return { ...best!, coins };
  } finally {
    host.destroy();
    for (const a of assets) a.bitmap.close();
  }
}

const stopped = (o: DrawOptions) => {
  if (o.signal?.aborted) throw Object.assign(new Error("⏹️ وقّفت الرسم."), { name: "AbortError" });
};

/**
 * A MOTION SLIDE: he writes the slide as a moving scene, the page loads it (its errors go back to be fixed), he looks at
 * a sheet of its frames and rewrites it below the bar, then the page renders the best one to MP4 with its sound (the
 * scene's own sound() and the library's effects at its cues). `png` is its last frame.
 */
async function drawMotion(o: DrawOptions, m: DrawMotion): Promise<DrawResult> {
  const { assets, call } = await prepare({ ...o, photos: (o.photos ?? []).slice(0, PHOTOS_PER_ROUND) });
  let coins = 0;
  o.onStep({ text: `🎬 حيدرا ماكس يكتب الشريحة ${m.n} مشهدًا متحركًا…` });
  let w = await call<Wrote>({ action: "write" });
  coins += w.coins ?? 0;
  let code = w.code;
  let problems = w.problems;
  const fonts = w.fonts;
  const [W, H] = w.size;
  if (!(await canExport(W, H))) throw new Error("متصفحك ما يقدر يطلّع فيديو الشريحة. افتح الصفحة في Chrome أو Edge على الكمبيوتر وأعد المحاولة.");
  const host = new SceneHost();
  try {
    let best: { result: DrawResult; code: string } | null = null;
    let info: SceneInfo | null = null;
    for (let round = 1; round <= CODE_ROUNDS; round++) {
      for (let fix = 0; ; fix++) {
        stopped(o);
        try {
          if (problems.length) throw new SceneError(problems.join("; "), "check");
          o.onStep({ text: `أشغّل الشريحة ${m.n} من برنامجها${round > 1 ? ` (جولة ${round})` : ""}…` });
          info = await host.load(code, { w: W, h: H, fps: 30, assets, fonts: sceneFonts(fonts) });
          const err = await probe(host, info.duration);
          if (err) throw err;
          break;
        } catch (e) {
          if (!(e instanceof SceneError) || fix >= CODE_FIXES) throw e instanceof SceneError ? new Error(`برنامج الشريحة ما اشتغل بعد ${fix + 1} محاولات: ${e.message}`) : e;
          o.onStep({ text: "البرنامج طلع فيه خطأ — حيدرا ماكس يصلّحه…" });
          w = await call<Wrote>({ action: "write", code, errors: `${e.where}${e.t != null ? ` at t=${e.t.toFixed(2)}s` : ""}: ${e.message}\n${e.stack2}` });
          coins += w.coins ?? 0;
          code = w.code;
          problems = w.problems;
        }
      }
      const d = info!.duration;
      const last = await host.frame(Math.max(0, d - 1 / 30));
      const png = await bitmapTo(last, "image/png");
      const still = await bitmapTo(last, "image/jpeg", 1280, 0.85);
      last.close();
      // big enough cells for him to read the Arabic of every frame
      const sheet = await sheetAt(host, Array.from({ length: 12 }, (_, i) => Math.min((d * i) / 11, d - 1 / 30)), 4, 300);
      o.onStep({ text: `حيدرا ماكس يشوف فريمات الشريحة ${m.n} ويقيّمها (جولة ${round} من ${CODE_ROUNDS})…`, preview: `data:image/jpeg;base64,${still}` });
      const r = await call<Reviewed>({ action: "review", code, still: sheet, round });
      coins += r.coins ?? 0;
      best = { result: { png, scores: r.review.scores, pass: r.review.pass, verdict: r.review.verdict, rounds: round, coins }, code };
      if (r.review.pass || !r.code) break;
      code = r.code;
      problems = r.problems;
    }
    // the best version is the one on the scene page (a rewrite is only kept when it was loaded and looked at)
    if (best!.code !== code) info = await host.load(best!.code, { w: W, h: H, fps: 30, assets, fonts: sceneFonts(fonts) });
    stopped(o);
    o.onStep({ text: `🔊 أركّب صوت الشريحة ${m.n}…` });
    const synth = info!.sound ? await host.sound().catch(() => null) : null;
    const cues = readCues(info!.cues, info!.duration).flatMap((c) => (m.sfx?.[c.sfx] ? [{ url: m.sfx[c.sfx], t: c.t, vol: c.vol }] : []));
    const audio = synth || cues.length ? await mixSoundtrack({ duration: info!.duration, synth, cues, voice: null, music: null }) : null;
    const video = await renderVideo(host, { duration: info!.duration, fps: 30, blur: info!.blur, sub: info!.blur > 0 ? 3 : 1, audio }, (p) => o.onStep({ text: `🎞️ أطلّع فيديو الشريحة ${m.n}… ${Math.round(p * 100)}٪` }), o.signal);
    return { ...best!.result, coins, video };
  } finally {
    host.destroy();
    for (const a of assets) a.bitmap.close();
  }
}

/** A reference picture made small for Claude's eyes (long side 768, JPEG base64), or null when it can't be read. */
export async function smallJpeg(url: string): Promise<string | null> {
  try {
    const bm = await createImageBitmap(await (await fetch(url)).blob());
    const out = await bitmapTo(bm, "image/jpeg", 768, 0.82);
    bm.close();
    return out;
  } catch {
    return null;
  }
}

/** Base64 a request may carry: Vercel refuses bodies over 4.5 MB, and a photo-real slide's PNG passes that. */
const INLINE_PNG = 3_000_000;

/**
 * The drawn PNG for a request body: inline when small, else put up first as the person's upload and sent by its id
 * (the server reads it once and drops it; see drawnPng).
 */
export async function pngBody(png: string): Promise<{ png: string } | { pngUpload: string }> {
  if (png.length <= INLINE_PNG) return { png };
  const blob = new Blob([Uint8Array.from(atob(png), (c) => c.charCodeAt(0))], { type: "image/png" });
  const signed = await postJson<{ id: string; signedUrl: string }>("/api/jawad/uploads", { kind: "image", mime: "image/png", bytes: blob.size, fileName: "drawn.png" });
  await putWithProgress(signed.signedUrl, new File([blob], "drawn.png", { type: "image/png" }), "image/png", () => {});
  const conf = await postJson<{ upload: { status: string; error: string | null } }>("/api/jawad/uploads/confirm", { id: signed.id });
  if (conf.upload?.status !== "ready") throw new Error(conf.upload?.error ?? "تعذّر رفع الصورة.");
  return { pngUpload: signed.id };
}

/** Keeps the picture as a work of «أعمالي». */
export const savePicture = <T>(body: { idempotencyKey: string; png: string; prompt: string; aspect: string; sectionId: string; styleId?: string; model: string; rounds: number; scores: Record<string, number> }) => {
  const { png, ...rest } = body;
  return pngBody(png).then((pic) => postJson<T>(URL, { action: "save", ...rest, ...pic }));
};
