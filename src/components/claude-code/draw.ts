// «Claude Code» in the image studio, in the browser: the picture's program is written on the server, rendered HERE in
// the motion lab's sandboxed scene page at full size, looked at by Claude (a smaller JPEG), rewritten while it is below
// the bar, and the final PNG is kept as a work of «أعمالي». A program that throws goes back to be fixed first.

import { postJson } from "@/lib/fetch";
import { CODE_FIXES, CODE_ROUNDS } from "@/lib/claude-code/skill";
import { SceneHost, SceneError, sceneFont } from "@/components/jawad/editor/scene-host";

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

type DrawOptions = { prompt: string; aspect: string; style: string; references: string[]; photos?: string[]; model: string; signal?: AbortSignal; onStep: (s: DrawStep) => void; from?: "studio" | "designer" | "content"; edit?: DrawEdit | null };

/**
 * Draws the picture by program, with up to CODE_ROUNDS looks and rewrites. `photos` are the person's pictures to PUT IN
 * the picture as they are (a speaker's photo, a logo): handed to the scene as photo1…photo10 and shown to Claude. More
 * than ten (up to twenty) are placed in a SECOND drawing whose base is the first picture.
 */
export async function drawWithCode(o: DrawOptions): Promise<DrawResult> {
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
  const call = <T>(body: Record<string, unknown>) => postJson<T>(URL, { model: o.model, prompt: o.prompt, aspect: o.aspect, style: o.style, references: o.references, photos, from: o.from ?? "studio", ...body }, o.signal);
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

/** Keeps the picture as a work of «أعمالي». */
export const savePicture = <T>(body: { idempotencyKey: string; png: string; prompt: string; aspect: string; sectionId: string; styleId?: string; model: string; rounds: number; scores: Record<string, number> }) => postJson<T>(URL, { action: "save", ...body });
