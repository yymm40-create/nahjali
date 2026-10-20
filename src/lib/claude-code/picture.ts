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
import { checkScene, LAB_FONTS } from "@/lib/editor/scene/contract";
import { MILLION_DOLLAR, SCENE_CONTRACT } from "@/lib/editor/scene/skill";
import { CLAUDE_CODE_WAY, CODE_PASS, CODE_ROUNDS } from "./skill";
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

const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 1_400_000 ? v : null);
const font = (v: unknown, d: string) => (typeof v === "string" && LAB_FONTS.includes(v) ? v : d);
const fontMenu = () => LAB_FONTS.map((id) => `${id} (${FONT_BY_ID.get(id)?.kind})`).join(", ");

async function ask<T>(user: RobotUser, model: unknown, label: string, parts: ClaudePart[], schema: object, maxTokens: number) {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرا ماكس غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(300_000);
  return robotTurn(user, model, label, async () => {
    const r = await callClaudeJson<T>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema, maxTokens, effort: "high", fallback: true, signal: deadline }).catch((e) => {
      console.error("claude code picture", label, e);
      if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت. أعد المحاولة.", 504);
      throw new UserError(claudeWhy(e, "ما قدر حيدرا ماكس يكمل الصورة الحين. جرّب مرة ثانية.", user.email), 502);
    });
    return { ...r, usd: claudeCost(r.usage) };
  });
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

/** WRITE (or FIX after the scene page threw) the picture's program. */
export async function pictureWrite(user: RobotUser, b: Record<string, unknown>) {
  const prompt = text(b.prompt, 6000);
  if (prompt.length < 2) throw new UserError("اكتب وش تبي في الصورة.", 400);
  const [w, h] = pictureSize(b.aspect);
  const style = text(b.style, 2000);
  const previous = text(b.code, 140_000);
  const errors = text(b.errors, 4000);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the picture's program below." : "DRAW this picture in code."}
THE REQUEST (the person's words — every word they want written appears EXACTLY as given, Arabic right to left): ${prompt}
FRAME: ${w}×${h} (${b.aspect ?? "1:1"}) · FONTS you may pick (catalogue ids): ${fontMenu()}
${style ? `THE LOOK the person chose («الستايل»), to follow in every shape, light and texture: ${style}` : "No look chosen: pick a bold, original one that fits the request (never the safe template look)."}
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the scene page — fix exactly this):\n${errors || "(no error text)"}` : ""}
Return the COMPLETE program and the two fonts it uses.`,
    },
    ...photosParts(b.photos),
    ...refsParts(b.references),
  ];
  const r = await ask<{ code: string; fonts: { head: string; body: string }; notes: string }>(user, b.model, previous ? "حيدرا ماكس · تصليح الصورة" : "حيدرا ماكس · رسم الصورة", parts, WRITE_SCHEMA, 64_000);
  const chk = checkScene(r.data.code);
  return { code: chk.code, problems: chk.problems, fonts: { head: font(r.data.fonts?.head, LAB_FONTS[0]), body: font(r.data.fonts?.body, LAB_FONTS[0]) }, notes: text(r.data.notes, 600), size: [w, h], coins: r.coins, model: r.model };
}

/** REVIEW: he looks at the rendered picture, scores it, and rewrites the program below the bar. */
export async function pictureReview(user: RobotUser, b: Record<string, unknown>) {
  const prompt = text(b.prompt, 6000);
  const code = checkScene(b.code).code;
  const still = jpeg(b.still);
  if (!code || !still) throw new UserError("ما وصلتني الصورة أو البرنامج.", 400);
  const round = Math.max(1, Math.min(CODE_ROUNDS, Math.round(Number(b.round) || 1)));
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW ROUND ${round} of ${CODE_ROUNDS}. Be a HARSH art director, not a proud author. Judge the picture you SEE below (rendered from THE PROGRAM), not what the code intends.
THE REQUEST: ${prompt}
${text(b.style, 2000) ? `THE LOOK chosen: ${text(b.style, 2000)}` : ""}
Score every criterion 1–10: ${PICTURE_RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}. Name the worst problems and the exact fix. If ANY score is below ${CODE_PASS}, return the COMPLETE revised program; otherwise code = "".
THE PROGRAM:
${code}`,
    },
    { type: "text", text: "THE PICTURE:" },
    { type: "image64", data: still, mediaType: "image/jpeg" },
    ...photosParts(b.photos),
    ...refsParts(b.references),
  ];
  const r = await ask<Record<string, unknown>>(user, b.model, `حيدرا ماكس · مراجعة الصورة ${round}`, parts, REVIEW_SCHEMA, 64_000);
  const s = (r.data.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(PICTURE_RUBRIC.map((x) => [x.id, Math.max(1, Math.min(10, Math.round(Number(s[x.id]) || 1)))])) as Record<string, number>;
  const pass = Object.values(scores).every((v) => v >= CODE_PASS);
  const revised = !pass && typeof r.data.code === "string" && r.data.code.trim() ? checkScene(r.data.code) : null;
  return { review: { scores, pass, verdict: text(r.data.verdict, 600) }, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}
