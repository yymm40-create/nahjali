// «مختبر الموشن» on the server — حيدرة as motion director and creative coder, in three calls to Claude (the person's
// model; Opus 5.5 by default): PLAN (the idea, the look and the shot list, from the brief, the references and the
// assets), WRITE (the scene program on the kit), REVIEW (he LOOKS at contact sheets and stills rendered in the
// person's browser, scores them like a harsh director and, below the bar, rewrites the program). The owner's motion
// skill is given word for word as the method; the lab's training (skill.ts) is the machine and the bar. Paid by real
// use like every robot turn. Rendering never happens here: the browser renders (scene-host.ts).

import { UserError } from "@/lib/api";
import { claudeModelOf } from "@config/claude-models";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart } from "@/lib/film/anthropic";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { MOTION_DIRECTOR_SKILL_TEXT } from "@/lib/editor/motion-director-text";
import { claudeCharged, type Who } from "@/lib/editor/pricing";
import { stillOpen, type EditorProject } from "@/lib/editor/server";
import { checkScene, LAB_FONTS, readPlan, readReview, SECONDS, type LabPlan } from "./contract";
import { EXEMPLARS } from "./exemplars";
import { MAX_ROUNDS, MOTION_LAB_SKILL, PASS, RUBRIC } from "./skill";

const SYSTEM = `${MOTION_LAB_SKILL}

THE OWNER'S METHOD — his own skill file, word for word, between <motion-skill> tags. It is the method (the brief, the director/producer knowledge, the intensity table, the catalogue, the principles, colour, sound, 3D, typography, the reference protocol, the recipes, the QA). It was written for a machine with a terminal: HERE THE LAB IS THAT MACHINE — its deterministic drawFrame(t) is your scene's draw(K, t, ctx), its render CLI and contact sheets are the lab's renders (you receive the sheets and stills), its ffmpeg is the browser's encoder. Skip only its terminal mechanics (folders, PROGRESS.md, .env, MCPs, Playwright, ffmpeg commands); everything else applies.
<motion-skill>
${MOTION_DIRECTOR_SKILL_TEXT}
</motion-skill>`;

const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 900_000 ? v : null);
const pics = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map(jpeg).filter((x): x is string => Boolean(x)).slice(0, max);
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

interface Asset {
  id: string;
  name: string;
  w: number;
  h: number;
}
const assetsOf = (v: unknown): Asset[] =>
  (Array.isArray(v) ? v : []).slice(0, 12).map((a) => {
    const o = (a ?? {}) as Record<string, unknown>;
    return { id: text(o.id, 80), name: text(o.name, 120), w: Math.round(Number(o.w) || 0), h: Math.round(Number(o.h) || 0) };
  }).filter((a) => a.id);

function frameOf(p: EditorProject) {
  const w = p.timeline.width || 1080, h = p.timeline.height || 1920;
  return { w, h, shape: h > w * 1.2 ? "portrait 9:16" : w > h * 1.2 ? "landscape 16:9" : "square-ish" };
}

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "idea", "hook", "format", "wow", "intensity", "seconds", "bpm", "palette", "fonts", "shots", "assets", "music", "say"],
  properties: {
    title: { type: "string" },
    idea: { type: "string", description: "the one idea in one sentence" },
    hook: { type: "string", description: "what is on frame 1 and why it stops the scroll" },
    format: { type: "string", description: "the viral format (or your own)" },
    wow: { type: "string", description: "the one moment nobody has seen in a template" },
    intensity: { type: "integer" },
    seconds: { type: "number" },
    bpm: { type: "integer" },
    palette: { type: "object", additionalProperties: false, required: ["bg", "ink", "accent", "second", "muted"], properties: { bg: { type: "string" }, ink: { type: "string" }, accent: { type: "string" }, second: { type: "string" }, muted: { type: "string" } } },
    fonts: { type: "object", additionalProperties: false, required: ["head", "body"], properties: { head: { type: "string" }, body: { type: "string" } } },
    shots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "what", "motion", "camera", "text", "transition", "sound"],
        properties: { from: { type: "number" }, to: { type: "number" }, what: { type: "string" }, motion: { type: "string" }, camera: { type: "string" }, text: { type: "string" }, transition: { type: "string" }, sound: { type: "string" } },
      },
    },
    assets: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "use"], properties: { id: { type: "string" }, use: { type: "string" } } } },
    music: { type: "string", description: "the music bed in words (mood, tempo, instruments), or empty" },
    say: { type: "string", description: "to the person, in Gulf Arabic, 1–2 sentences: the idea and why it will stop the scroll" },
  },
};

const CODE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["code", "notes"],
  properties: { code: { type: "string", description: "the complete scene program" }, notes: { type: "string", description: "to the person, Gulf Arabic, one sentence on what you built or fixed" } },
};

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "worst", "verdict", "code"],
  properties: {
    scores: { type: "object", additionalProperties: false, required: RUBRIC.map((r) => r.id), properties: Object.fromEntries(RUBRIC.map((r) => [r.id, { type: "integer", description: r.en }])) },
    worst: { type: "array", items: { type: "object", additionalProperties: false, required: ["t", "problem", "fix"], properties: { t: { type: "number" }, problem: { type: "string" }, fix: { type: "string" } } } },
    verdict: { type: "string", description: "to the person, Gulf Arabic, 1–2 sentences: what you saw and what you changed" },
    code: { type: "string", description: `the COMPLETE revised program when any score is below ${PASS}; empty when every score is ≥ ${PASS}` },
  },
};

const fontMenu = () => LAB_FONTS.map((id) => `${id} (${FONT_BY_ID.get(id)?.kind})`).join(", ");
const exemplarsText = () => EXEMPLARS.map((e) => `<example name="${e.name}" shows="${e.shows}">\n${e.code}\n</example>`).join("\n\n");
const planText = (p: LabPlan) => JSON.stringify(p, null, 1);
const outputBudget = (model: unknown) => claudeModelOf(model).key === "haiku" ? 64_000 : 128_000;

async function ask<T>(who: Who, model: unknown, label: string, parts: ClaudePart[], schema: object, maxTokens: number, effort: "medium" | "high" | "xhigh" = "high") {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);
  const deadline = AbortSignal.timeout(600_000);
  return claudeCharged(
    who,
    model,
    label,
    () =>
      callClaudeJson<T>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema, maxTokens, effort, fallback: true, signal: deadline }).catch((e) => {
        console.error("motion lab", label, e);
        if (deadline.aborted) throw new UserError("خدمة الذكاء الاصطناعي تأخرت في هذه الخطوة. الخطة والمشهد السابق محفوظان؛ أعد المحاولة من نفس الخطوة.", 504);
        throw new UserError(claudeWhy(e, "ما قدر حيدرة يكمل الموشن الحين. جرّب مرة ثانية.", who.email), 502);
      }),
    (x) => claudeCost(x.usage),
  );
}

/** 1 · PLAN: the idea, the look and the shot list (the person approves it before any code). */
export async function labPlan(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const brief = text(b.brief, 6000);
  if (brief.length < 3) throw new UserError("اكتب فكرة الموشن أول.");
  const seconds = Math.min(SECONDS.max, Math.max(SECONDS.min, Math.round(Number(b.seconds) || 15)));
  const assets = assetsOf(b.assets);
  const refs = pics(b.references, 4);
  const f = frameOf(p);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `PLAN a motion-graphics piece for this project. Do NOT write code yet.
THE BRIEF (the person's words): ${brief}
LENGTH: ${seconds} s · FRAME: ${f.w}×${f.h} (${f.shape}) · INTENSITY wanted: ${Number(b.intensity) || "your call from the brief"} · LANGUAGE: ${text(b.language, 40) || "Arabic (Gulf)"}
BRAND: ${text(b.brand, 800) || "none given — design a palette for the idea (one accent)"}
ASSETS the scene can draw (by id): ${assets.length ? assets.map((a) => `${a.id} = «${a.name}» ${a.w}×${a.h}`).join("; ") : "none — you draw everything in code"}
FONTS you may pick (catalogue ids): ${fontMenu()}
${refs.length ? `REFERENCES: ${refs.length} frame(s) below — take their colours, type, pacing and finish (never their content), as the skill's reference protocol says.` : "No references: avoid the safe default look; pick a viral format and push it."}
Make it a studio piece: a hook on frame 1, one hero per shot, the beat grid, one object carrying across shots, the "wow" moment, a held ending or a loop. Times in seconds; shots cover the whole length without gaps. Every on-screen word written exactly (Arabic as it will appear).`,
    },
    ...refs.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `REFERENCE ${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, "مختبر الموشن · الخطة", parts, PLAN_SCHEMA, 12000, "high");
  return { plan: readPlan(r.data, seconds, assets.map((a) => a.id)), say: text(r.data.say, 600), coins: r.coins, model: r.model };
}

/** 2 · WRITE: the scene program on the kit, from the approved plan (or a fix of the last one, from its errors). */
export async function labWrite(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const assets = assetsOf(b.assets);
  const plan = readPlan(b.plan, Number(b.seconds) || 15, assets.map((a) => a.id));
  const f = frameOf(p);
  const previous = typeof b.code === "string" ? text(b.code, 140_000) : "";
  const errors = text(b.errors, 4000);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the scene program below." : "WRITE the scene program for this approved plan."}
THE PLAN (approved by the person — follow it; improve only what the bar demands):
${planText(plan)}
FRAME: ${f.w}×${f.h} (${f.shape}) · FONTS loaded for you: K.fonts.head = ${plan.fonts.head}, K.fonts.body = ${plan.fonts.body}
ASSETS: ${assets.length ? assets.map((a) => `K.img("${a.id}") = «${a.name}» ${a.w}×${a.h}`).join("; ") : "none"}
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the scene page — fix exactly this, keep everything else):\n${errors || "(no error text)"}` : `REFERENCE SCENES (the level of craft expected — learn the technique, never copy them):\n${exemplarsText()}`}
Write the COMPLETE program (it replaces the old one). duration = ${plan.seconds}, bpm = ${plan.bpm}. Use the palette's hex values. Cues on the changes. Make every frame worthy of the bar.`,
    },
  ];
  const r = await ask<{ code: string; notes: string }>(who, b.model, previous ? "مختبر الموشن · تصليح" : "مختبر الموشن · كتابة المشهد", parts, CODE_SCHEMA, outputBudget(b.model), previous ? "medium" : "high");
  const chk = checkScene(r.data.code);
  return { code: chk.code, problems: chk.problems, notes: text(r.data.notes, 600), coins: r.coins, model: r.model };
}

/** 3 · REVIEW: he looks at what the browser rendered, scores it, and rewrites it when it is below the bar. */
export async function labReview(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const assets = assetsOf(b.assets);
  const plan = readPlan(b.plan, Number(b.seconds) || 15, assets.map((a) => a.id));
  const code = checkScene(b.code).code;
  if (!code) throw new UserError("ما وصلني المشهد.", 400);
  const sheets = pics(b.sheets, 3), stills = pics(b.stills, 6);
  if (!sheets.length && !stills.length) throw new UserError("ما وصلتني صور المشهد.", 400);
  const round = Math.max(1, Math.min(MAX_ROUNDS, Math.round(Number(b.round) || 1)));
  const times = (Array.isArray(b.times) ? b.times : []).map(Number).filter(Number.isFinite).slice(0, 6);
  const reviewOnly = b.reviewOnly === true;
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW ROUND ${round} of ${MAX_ROUNDS}${round === MAX_ROUNDS ? " (the last: if anything is still below the bar, give your best final program)" : ""}. Be a HARSH motion director, not a proud author.
Below: ${sheets.length} contact sheet(s) (the frames of the whole piece in order, the time under each) and ${stills.length} full-size still(s)${times.length ? ` at ${times.map((t) => `${t.toFixed(2)} s`).join(", ")}` : ""}, rendered from THE PROGRAM. Judge what you SEE, not what the code intends.
Score every criterion 1–10 (10 = indistinguishable from a top studio): ${RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}.
Check the blacklist. Name the 3 worst problems with their times and the exact fix. ${reviewOnly ? "Return code as an empty string. A separate writing step will apply your exact corrections; describe the fixes precisely and do not claim you applied them." : `If ANY score is below ${PASS}, return the COMPLETE revised program that fixes them (keep what already works); otherwise return code as an empty string.`}
THE PLAN: ${planText(plan)}
THE PROGRAM:
${code}`,
    },
    ...sheets.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `CONTACT SHEET ${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
    ...stills.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `STILL ${i + 1}${times[i] !== undefined ? ` (t = ${times[i].toFixed(2)} s)` : ""}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, `مختبر الموشن · مراجعة ${round}`, parts, REVIEW_SCHEMA, reviewOnly ? 12000 : outputBudget(b.model), "high");
  const review = readReview(r.data);
  const revised = !review.pass && typeof r.data.code === "string" && r.data.code.trim() ? checkScene(r.data.code) : null;
  return { review, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}
