// «Claude Code» in the image studio — a picture DRAWN IN CODE: Claude writes a scene program for one still on the motion
// lab's kit (the same sandboxed scene page, src/lib/editor/scene/runtime.ts, so every effect of the kit is there:
// particles, glass, light sweeps, depth of field, bloom, grain, real Arabic type in the catalogue's fonts), the person's
// browser renders it at full size, he LOOKS at it, scores it like a harsh art director and rewrites it until every score
// passes; the final picture is saved as an ordinary work of «أعمالي». Exact Arabic text, crisp shapes, no picture model.
// Paid by real use like every robot turn (robotTurn). Server only.

import { UserError } from "@/lib/api";
import { robotTurn, type RobotUser } from "@/lib/claude-run";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { pinnedFont } from "@config/content-fonts";
import { checkScene, LAB_FONTS } from "@/lib/editor/scene/contract";
import { MILLION_DOLLAR, SCENE_CONTRACT } from "@/lib/editor/scene/skill";
import { applyEdits, readEdits } from "@/lib/patch";
import { CLAUDE_CODE_WAY, CODE_PASS, CODE_ROUNDS, lastRound } from "./skill";
import { PICTURE_RUBRIC, pictureSize } from "./picture-rubric";

export { PICTURE_RUBRIC, PICTURE_SIZES, pictureSize } from "./picture-rubric";

const SYSTEM = `You are «جواد»'s creative coder at JAWAD AI, drawing a PICTURE IN CODE — «حيدرا ماكس» (never call yourself Claude). You design and code the picture yourself, new for this request: there is no image model, only your program.

${CLAUDE_CODE_WAY}

THIS IS A STILL PICTURE, NOT A FILM: write the scene with duration: 1 and blur: 0; the picture is the frame at t = 0 (draw everything finished at t = 0: no entrances, nothing half-way). Cues: none. Everything about motion in the text below applies only as composition, light and finish.

${MILLION_DOLLAR}

${SCENE_CONTRACT}`;

const WRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["code", "fonts", "notes"],
  properties: {
    code: { type: "string", description: "the COMPLETE scene program for the still" },
    fonts: { type: "object", additionalProperties: false, required: ["head", "body"], properties: { head: { type: "string" }, body: { type: "string" } } },
    notes: { type: "string", description: "to the person, Gulf Arabic, one sentence on the picture you built (or fixed)" },
  },
};
const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "worst", "verdict", "code"],
  properties: {
    scores: { type: "object", additionalProperties: false, required: PICTURE_RUBRIC.map((r) => r.id), properties: Object.fromEntries(PICTURE_RUBRIC.map((r) => [r.id, { type: "integer", description: r.en }])) },
    worst: { type: "array", items: { type: "object", additionalProperties: false, required: ["problem", "fix"], properties: { problem: { type: "string" }, fix: { type: "string" } } } },
    verdict: { type: "string", description: "to the person, Gulf Arabic, 1–2 sentences: what you saw and what you changed" },
    code: { type: "string", description: `the COMPLETE revised program when any score is below ${CODE_PASS}; empty when every score is ≥ ${CODE_PASS}` },
  },
};

// A CHANGE to a picture drawn before (opt-in: b.edit / b.patch, sent only by «المصمم الذكي») comes back as a PATCH —
// exact search/replace edits on its program (src/lib/patch.ts), a few hundred tokens instead of a whole program.
const EDITS = {
  type: "array",
  description: "exact search/replace edits on THE PROGRAM, applied in order (each on the program as the edits before it left it): `old` is copied character for character from it (same spaces and indentation) and occurs in it EXACTLY ONCE — take a line or two around the spot when needed; `new` replaces it",
  items: { type: "object", additionalProperties: false, required: ["old", "new"], properties: { old: { type: "string" }, new: { type: "string" } } },
};
const EDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["edits", "code", "fonts", "notes"],
  properties: {
    edits: EDITS,
    code: { type: "string", description: "ONLY when the change rewrites most of the program: the COMPLETE program, with edits []; else empty" },
    fonts: WRITE_SCHEMA.properties.fonts,
    notes: WRITE_SCHEMA.properties.notes,
  },
};
const REVIEW_EDIT_SCHEMA = {
  ...REVIEW_SCHEMA,
  required: [...REVIEW_SCHEMA.required, "edits"],
  properties: {
    ...REVIEW_SCHEMA.properties,
    edits: { ...EDITS, description: `when any score is below ${CODE_PASS}: ${EDITS.description}; else []` },
    code: { type: "string", description: "ONLY when the fix rewrites most of the program: the COMPLETE revised program, with edits []; else empty" },
  },
};

/**
 * A patch answer on `program`: its edits applied in order (each old text exactly once), or — only when he wrote the whole
 * program instead — that program; `patchFailed` (why) when neither can be used.
 */
export function patchProgram(program: string, d: { code?: unknown; edits?: unknown }): { code: string } | { patchFailed: string } {
  const edits = readEdits(d.edits);
  const all = typeof d.code === "string" ? d.code.trim() : "";
  if (!edits.length) return all ? { code: all } : { patchFailed: "the patch has no edits" };
  const done = applyEdits(program, edits);
  return done.ok ? { code: done.text } : all ? { code: all } : { patchFailed: done.why };
}

const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 1_400_000 ? v : null);
const font = (v: unknown, d: string) => (typeof v === "string" && LAB_FONTS.includes(v) ? v : d);
const fontMenu = () => LAB_FONTS.map((id) => `${id} (${FONT_BY_ID.get(id)?.kind})`).join(", ");

async function ask<T>(user: RobotUser, model: unknown, label: string, parts: ClaudePart[], schema: object, maxTokens: number, effort: "medium" | "high" = "high") {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرا ماكس غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(300_000);
  return robotTurn(user, model, label, async () => {
    const r = await callClaudeJson<T>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema, maxTokens, effort, fallback: true, signal: deadline }).catch((e) => {
      console.error("claude code picture", label, e);
      if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت. أعد المحاولة.", 504);
      throw new UserError(claudeWhy(e, "ما قدر حيدرا ماكس يكمل الصورة الحين. جرّب مرة ثانية.", user.email), 502);
    });
    return { ...r, usd: claudeCost(r.usage) };
  }, undefined, { price: "max" });
}

/** The person's photos to PUT IN the picture as they are (the scene has them as photo1…photo4). */
function photosParts(raw: unknown): ClaudePart[] {
  const list = (Array.isArray(raw) ? raw : []).map(jpeg).filter((x): x is string => !!x).slice(0, 10);
  if (!list.length) return [];
  return [
    { type: "text", text: `THE PERSON'S PHOTOS TO PLACE IN THE PICTURE (${list.length}): the scene has them as K.img("photo1")…K.img("photo${list.length}") — draw each one INTO the design with K.picture(ctx, "photoN", x, y, w, h, { fit: "cover", radius }) or ctx.drawImage(K.img("photoN"), …), as the request says (a speaker in a frame, a large hero portrait, a logo). Keep every face EXACTLY as photographed: never redraw, distort, stretch or cover a face with text or shapes. You may crop and scale (keeping the proportions), clip to a frame or a shape, fade the edges into the background with gradient masks (on an offscreen layer: K.layer(name) with globalCompositeOperation "destination-in"/"destination-out"), grade it (ctx.filter: grayscale, sepia, contrast, brightness) and blend it (a double exposure over the scene). Every photo given must appear.` },
    ...list.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `PHOTO photo${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
}

function refsParts(raw: unknown): ClaudePart[] {
  const list = (Array.isArray(raw) ? raw : []).map(jpeg).filter((x): x is string => !!x).slice(0, 4);
  return list.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `REFERENCE ${i + 1} (take its colours, type and finish — never copy its content unless asked):` }, { type: "image64", data: d, mediaType: "image/jpeg" }]);
}

/** WRITE (or FIX after the scene page threw, or — with b.edit — CHANGE as a patch) the picture's program. */
export async function pictureWrite(user: RobotUser, b: Record<string, unknown>) {
  const prompt = text(b.prompt, 16000);
  if (prompt.length < 2) throw new UserError("اكتب وش تبي في الصورة.", 400);
  const [w, h] = pictureSize(b.aspect);
  const style = text(b.style, 2000);
  // the font the person chose in «صانع المحتوى» (carried in the look): every word is set in it
  const pin = pinnedFont(style);
  const previous = text(b.code, 140_000);
  const errors = text(b.errors, 4000);
  if (b.edit === true && previous && !errors) return pictureEdit(user, b, prompt, previous, [w, h], style);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the picture's program below." : "DRAW this picture in code."}
THE REQUEST (the person's words — every word they want written appears EXACTLY as given, Arabic right to left): ${prompt}
FRAME: ${w}×${h} (${b.aspect ?? "1:1"}) · ${pin ? `THE FONT the person chose (catalogue id): ${pin} — set every Arabic word in it, and return it as both fonts` : `FONTS you may pick (catalogue ids): ${fontMenu()}`}
${style ? `THE LOOK the person chose («الستايل»), to follow in every shape, light and texture: ${style}` : "No look chosen: pick a bold, original one that fits the request (never the safe template look)."}
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the scene page — fix exactly this):\n${errors || "(no error text)"}` : ""}
Return the COMPLETE program and the two fonts it uses.`,
    },
    ...photosParts(b.photos),
    ...refsParts(b.references),
  ];
  const r = await ask<{ code: string; fonts: { head: string; body: string }; notes: string }>(user, b.model, previous ? "حيدرا ماكس · تصليح الصورة" : "حيدرا ماكس · رسم الصورة", parts, WRITE_SCHEMA, 64_000);
  const chk = checkScene(r.data.code);
  return { code: chk.code, problems: chk.problems, fonts: pin ? { head: pin, body: pin } : { head: font(r.data.fonts?.head, LAB_FONTS[0]), body: font(r.data.fonts?.body, LAB_FONTS[0]) }, notes: text(r.data.notes, 600), size: [w, h], coins: r.coins, model: r.model };
}

/**
 * CHANGE a picture drawn before: its program, the brief it was drawn from, the new brief and the person's words go in,
 * EDITS on the program come out (applied here; the whole program only when the change rewrites most of it). The look is
 * in the program already, so no reference pictures go with it, and the photos only when they changed. `patchFailed`
 * when the patch can't be applied: the page then draws the picture from zero.
 */
async function pictureEdit(user: RobotUser, b: Record<string, unknown>, prompt: string, previous: string, [w, h]: [number, number], style: string) {
  const f = (b.fonts ?? {}) as Record<string, unknown>;
  const fonts = { head: font(f.head, LAB_FONTS[0]), body: font(f.body, LAB_FONTS[0]) };
  const brief = text(b.brief, 16000);
  const said = text(b.said, 4000);
  const photos = (Array.isArray(b.photos) ? b.photos : []).filter((x) => jpeg(x)).length;
  const changed = b.photosChanged === true && photos > 0;
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `CHANGE the picture's program below. It drew THE PREVIOUS BRIEF and the picture was accepted; now the person asks for a change and the design has THE NEW BRIEF. Change ONLY what the change needs (a word, a typo, a line, a colour, a size, a place, an element added or removed) and keep everything else exactly as it is: the layout, the type, the light, the finish.
${said ? `THE PERSON'S WORDS (the change they asked for): ${said}\n` : ""}THE NEW BRIEF (every word they want written appears EXACTLY as given, Arabic right to left): ${prompt}
${brief ? `THE PREVIOUS BRIEF (what the program draws now): ${brief}\n` : ""}FRAME: ${w}×${h} (${b.aspect ?? "1:1"}) · FONTS now: head ${fonts.head}, body ${fonts.body} · FONTS you may pick (catalogue ids): ${fontMenu()}
${style ? `THE LOOK the person chose: ${style}` : ""}
${changed ? "THE PHOTOS TO PLACE CHANGED: they are given below (photo1… in this order); place each as the new brief says." : photos ? `The photos photo1…photo${photos} are the same ones the program already places.` : ""}
THE PROGRAM:
${previous}

Answer with "edits" on THE PROGRAM (exact search/replace) and code = ""; the COMPLETE program in "code" (edits []) only when the change rewrites most of it. Return the two fonts it uses (the same unless the change is the font).`,
    },
    ...(changed ? photosParts(b.photos) : []),
  ];
  // medium thought: the change is named and the answer is a patch
  const r = await ask<{ code: string; edits?: unknown; fonts: { head: string; body: string }; notes: string }>(user, b.model, "حيدرا ماكس · تعديل الصورة", parts, EDIT_SCHEMA, 64_000, "medium");
  const out = patchProgram(previous, r.data);
  const base = { fonts: { head: font(r.data.fonts?.head, fonts.head), body: font(r.data.fonts?.body, fonts.body) }, notes: text(r.data.notes, 600), size: [w, h], coins: r.coins, model: r.model };
  if ("patchFailed" in out) return { ...base, code: "", problems: [], patchFailed: out.patchFailed };
  const chk = checkScene(out.code);
  return { ...base, code: chk.code, problems: chk.problems };
}

/**
 * REVIEW: he looks at the rendered picture, scores it, and rewrites the program below the bar — with b.patch, as EDITS on
 * the program (applied here; the revised program comes back whole all the same).
 */
export async function pictureReview(user: RobotUser, b: Record<string, unknown>) {
  const prompt = text(b.prompt, 16000);
  const code = checkScene(b.code).code;
  const still = jpeg(b.still);
  if (!code || !still) throw new UserError("ما وصلتني الصورة أو البرنامج.", 400);
  const patch = b.patch === true;
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}.${lastRound(round)} Be a HARSH art director, not a proud author. Judge the picture you SEE below (rendered from THE PROGRAM), not what the code intends.
THE REQUEST: ${prompt}
${text(b.style, 2000) ? `THE LOOK chosen: ${text(b.style, 2000)}` : ""}
Score every criterion 1–10: ${PICTURE_RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}. Name the worst problems and the exact fix. ${patch ? `If ANY score is below ${CODE_PASS}, return "edits" on THE PROGRAM (exact search/replace) that fix them and code = "" (the complete program only when the fix rewrites most of it); otherwise edits [] and code = "".` : `If ANY score is below ${CODE_PASS}, return the COMPLETE revised program; otherwise code = "".`}
THE PROGRAM:
${code}`,
    },
    { type: "text", text: "THE PICTURE:" },
    { type: "image64", data: still, mediaType: "image/jpeg" },
    ...photosParts(b.photos),
    ...refsParts(b.references),
  ];
  const r = await ask<Record<string, unknown>>(user, b.model, `حيدرا ماكس · مراجعة الصورة ${round}`, parts, patch ? REVIEW_EDIT_SCHEMA : REVIEW_SCHEMA, 64_000);
  const s = (r.data.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(PICTURE_RUBRIC.map((x) => [x.id, Math.max(1, Math.min(10, Math.round(Number(s[x.id]) || 1)))])) as Record<string, number>;
  const pass = Object.values(scores).every((v) => v >= CODE_PASS);
  const fixed = pass ? null : patch ? patchProgram(code, r.data) : typeof r.data.code === "string" && r.data.code.trim() ? { code: r.data.code } : null;
  const revised = fixed && "code" in fixed ? checkScene(fixed.code) : null;
  return { review: { scores, pass, verdict: text(r.data.verdict, 600) }, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}
