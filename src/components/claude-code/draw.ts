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

type DrawOptions = { prompt: string; aspect: string; style: string; references: string[]; photos?: string[]; model: string; signal?: AbortSignal; onStep: (s: DrawStep) => void; from?: "studio" | "designer" | "content" };

/**
 * Draws the picture by program, with up to CODE_ROUNDS looks and rewrites. `photos` are the person's pictures to PUT IN
 * the picture as they are (a speaker's photo, a logo): handed to the scene as photo1…photo10 and shown to Claude. More
 * than ten (up to twenty) are placed in a SECOND drawing whose base is the first picture.
 */
export async function drawWithCode(o: DrawOptions): Promise<DrawResult> {
  const all = (o.photos ?? []).slice(0, PHOTOS_MAX);
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
  return { ...second, rounds: first.rounds + second.rounds, coins: first.coins + second.coins };
}

async function drawOnce(o: DrawOptions): Promise<DrawResult> {
  const list = o.photos ?? [];
  // many photos: a little smaller each, so ten full pictures fit a phone's memory
  const side = list.length > 4 ? 1600 : 2048;
  const loaded = (await Promise.all(list.map(async (url) => ({ bm: await photoBitmap(url, side), small: await smallJpeg(url) })))).filter((p): p is { bm: ImageBitmap; small: string } => !!p.bm && !!p.small);
  const assets = loaded.map((p, i) => ({ id: `photo${i + 1}`, bitmap: p.bm }));
  const photos = loaded.map((p) => p.small);
  const call = <T>(body: Record<string, unknown>) => postJson<T>(URL, { model: o.model, prompt: o.prompt, aspect: o.aspect, style: o.style, references: o.references, photos, from: o.from ?? "studio", ...body }, o.signal);
  let coins = 0;
  o.onStep({ text: "🧑‍💻 حيدرا ماكس يكتب برنامج الصورة…" });
  type Wrote = { code: string; problems: string[]; fonts: { head: string; body: string }; size: [number, number]; notes: string; coins: number };
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
          await host.load(code, { w: W, h: H, assets, fonts: [sceneFont("head", fonts.head), sceneFont("body", fonts.body)].filter((f): f is NonNullable<typeof f> => !!f) });
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
      const r = await call<{ review: { scores: Record<string, number>; pass: boolean; verdict: string }; code: string; problems: string[]; coins: number }>({ action: "review", code, still, round });
      coins += r.coins ?? 0;
      best = { png, scores: r.review.scores, pass: r.review.pass, verdict: r.review.verdict, rounds: round, coins };
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
