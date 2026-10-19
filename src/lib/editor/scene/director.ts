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
import { ALWAYS_AT_PLAN, HF_LAB_TEXT, knownRefs, openRefs } from "./higgsfield";
import { choicesRefs, choicesText, readChoices } from "@config/editor/lab-options";
import { FOOTAGE_KIT_API, FOOTAGE_SKILL, footageText, readFootage, type FootageMeta } from "./footage";

const SYSTEM = `${MOTION_LAB_SKILL}

THE OWNER'S METHOD — his own skill file, word for word, between <motion-skill> tags. It is the method (the brief, the director/producer knowledge, the intensity table, the catalogue, the principles, colour, sound, 3D, typography, the reference protocol, the recipes, the QA). It was written for a machine with a terminal: HERE THE LAB IS THAT MACHINE — its deterministic drawFrame(t) is your scene's draw(K, t, ctx), its render CLI and contact sheets are the lab's renders (you receive the sheets and stills), its ffmpeg is the browser's encoder. Skip only its terminal mechanics (folders, PROGRESS.md, .env, MCPs, Playwright, ffmpeg commands); everything else applies.
<motion-skill>
${MOTION_DIRECTOR_SKILL_TEXT}
</motion-skill>

${HF_LAB_TEXT}`;

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
  required: ["title", "idea", "hook", "format", "wow", "intensity", "seconds", "bpm", "palette", "fonts", "shots", "assets", "music", "narration", "skillRefs", "say"],
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
        required: ["from", "to", "what", "motion", "camera", "text", "transition", "sound", "frame"],
        properties: { from: { type: "number" }, to: { type: "number" }, what: { type: "string" }, motion: { type: "string" }, camera: { type: "string" }, text: { type: "string" }, transition: { type: "string" }, sound: { type: "string" }, frame: { type: "string", description: "ONLY when the piece is built on the person's video: how it sits in this shot — full | card | split | corner | away | over; otherwise empty" } },
      },
    },
    assets: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "use"], properties: { id: { type: "string" }, use: { type: "string" } } } },
    music: { type: "string", description: "the music bed in words (mood, tempo, instruments), or empty" },
    narration: {
      type: "array",
      description: "only when the person records their own voice: the lines they will read, in order, with the seconds planned for each; otherwise []",
      items: { type: "object", additionalProperties: false, required: ["text", "from", "to"], properties: { text: { type: "string" }, from: { type: "number" }, to: { type: "number" } } },
    },
    skillRefs: { type: "array", items: { type: "string" }, description: "ids from <skill-catalogue> to have open, word for word, while writing and reviewing this piece (≤ 12)" },
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

/** What the person chose for the sound: their own voice, and music made in code / by ElevenLabs / none. */
function soundAsk(b: Record<string, unknown>) {
  const music = b.musicMode === "code" ? "code" : b.musicMode === "eleven" ? "eleven" : "none";
  const filmed = Boolean(footageOf(b));
  return {
    voice: b.voice === "own" && !filmed,
    music,
    text: `THE SOUND (the piece comes out WITH its sound — never a silent film): write sound(K, S) and design every effect in code, timed to your own frames. Music: ${music === "code" ? `MADE IN CODE — a bed with S.drone and/or S.beat on the bpm, under everything${filmed ? " (quiet: it sits under their voice)" : ""}` : music === "eleven" ? "a separate music track is made for it (describe it in the plan's music); do NOT write a music bed in sound()" : "none — effects only (no S.drone / S.beat)"}.${filmed ? " THE VIDEO'S OWN SOUND (the person's voice) is mixed in for you and leads: your effects are short and soft while they speak (a whoosh or pop on each frame change, a tick on a word that appears), the bigger hits only in their pauses." : ""}`,
  };
}

/** The person's own filmed video, when the piece is built on it (what the browser measured), or null. */
const footageOf = (b: Record<string, unknown>): FootageMeta | null => readFootage(b.footage);
/** The footage's part of a prompt: the craft, what they say and where their face is (and the kit's calls when writing). */
function footagePart(b: Record<string, unknown>, kit: boolean) {
  const f = footageOf(b);
  return f ? `\n\n${FOOTAGE_SKILL}\n\n${footageText(f)}${kit ? `\n\n${FOOTAGE_KIT_API}` : ""}` : "";
}

/** The person's own recorded voice, measured: when each line is said (the visuals follow it). */
function voiceText(b: Record<string, unknown>) {
  const v = (b.voice_lines ?? null) as { seconds?: unknown; lines?: unknown } | null;
  const lines = (Array.isArray(v?.lines) ? v!.lines : []).slice(0, 30).map((x) => x as Record<string, unknown>).map((x) => ({ text: text(x.text, 300), from: Number(x.from) || 0, to: Number(x.to) || 0 }));
  const secs = Number(v?.seconds) || 0;
  if (!secs || !lines.length) return "";
  return `THE PERSON'S OWN VOICE narrates this piece (their recording, cleaned; it is mixed in under nothing — it leads). It lasts ${secs.toFixed(2)} s; the piece must last at least ${(secs + 0.8).toFixed(1)} s. Each line and WHEN it is said (measured from the recording):
${lines.map((l, i) => `${i + 1}. ${l.from.toFixed(2)}–${l.to.toFixed(2)} s: ${l.text ? `«${l.text}»` : "(a phrase)"}`).join("\n")}
Time the picture to the words: the line's key idea appears as it is said (a key word, a number, the thing named), shots change on the gaps between lines, nothing busy fights a spoken line; the same lines are in K.voice ([{text, from, to}]) if you want to read them in code. Don't print every spoken word as captions unless the plan says so. In sound(), keep effects short and soft while a line is spoken; the big ones go in the gaps.`;
}

const fontMenu = () => LAB_FONTS.map((id) => `${id} (${FONT_BY_ID.get(id)?.kind})`).join(", ");
const exemplarsText = () => EXEMPLARS.map((e) => `<example name="${e.name}" shows="${e.shows}">\n${e.code}\n</example>`).join("\n\n");
const planText = (p: LabPlan) => JSON.stringify(p, null, 1);
const outputBudget = (model: unknown) => claudeModelOf(model).key === "haiku" ? 64_000 : 128_000;

async function ask<T>(who: Who, model: unknown, label: string, parts: ClaudePart[], schema: object, maxTokens: number, effort: "medium" | "high" | "xhigh" = "high") {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);
  // no deadline of the lab's own (the owner's rule): a step runs as long as the platform's route allows
  return claudeCharged(
    who,
    model,
    label,
    () =>
      callClaudeJson<T>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema, maxTokens, effort, fallback: true }).catch((e) => {
        console.error("motion lab", label, e);
        throw new UserError(claudeWhy(e, "ما قدر حيدرة يكمل الموشن الحين. جرّب مرة ثانية.", who.email), 502);
      }),
    (x) => claudeCost(x.usage),
  );
}

/** 1 · PLAN: the idea, the look and the shot list (the person approves it before any code). */
export async function labPlan(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const foot = footageOf(b);
  // on the person's own video the idea may be left to him: the edit comes from what they say
  const brief = text(b.brief, 6000) || (foot ? "مونتاج موشن احترافي على كلامي في الفيديو: أنت تقرر متى أكون كامل الشاشة ومتى أصغر أو تنقسم الشاشة أو أختفي ويطلع شرح بالموشن، من كلامي نفسه." : "");
  if (brief.length < 3) throw new UserError("اكتب فكرة الموشن أول.");
  const seconds = foot ? foot.seconds : Math.min(SECONDS.max, Math.max(SECONDS.min, Math.round(Number(b.seconds) || 15)));
  const footFrames = foot ? pics(b.footage_frames, 4) : [];
  const assets = assetsOf(b.assets);
  const refs = pics(b.references, 4);
  const f = frameOf(p);
  // the gallery picks (look, structure, connections…): binding lines for the plan, and their skill files opened with it
  const choices = readChoices(b.choices);
  const chosen = choicesText(choices);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `PLAN a motion-graphics piece for this project. Do NOT write code yet.
THE BRIEF (the person's words): ${brief}${chosen ? `\n\n${chosen}\n` : ""}
LENGTH: ${seconds} s${foot ? " (exactly the video's length)" : ""} · FRAME: ${f.w}×${f.h} (${f.shape}) · INTENSITY wanted: ${Number(b.intensity) || "your call from the brief"} · LANGUAGE: ${text(b.language, 40) || "Arabic (Gulf)"}
BRAND: ${text(b.brand, 800) || "none given — design a palette for the idea (one accent)"}
ASSETS the scene can draw (by id): ${assets.length ? assets.map((a) => `${a.id} = «${a.name}» ${a.w}×${a.h}`).join("; ") : "none — you draw everything in code"}
FONTS you may pick (catalogue ids): ${fontMenu()}
${refs.length ? `REFERENCES: ${refs.length} frame(s) below — take their colours, type, pacing and finish (never their content), as the skill's reference protocol says.` : "No references: avoid the safe default look; pick a viral format and push it."}
${foot ? `"narration" is [] (their voice is the video's own sound). Every shot names its "frame". ` : soundAsk(b).voice ? `THE PERSON WILL RECORD THEIR OWN VOICE reading a narration YOU write: fill "narration" with the lines in order (${text(b.language, 40) || "Gulf Arabic"}, spoken words, short lines of one idea each, about 2 words a second so it is never rushed, from/to on the shots); the visuals are built to follow those words. ` : `"narration" is [] (no voice). `}${soundAsk(b).text}
Make it a studio piece: a hook on frame 1, one hero per shot, the beat grid, one object carrying across shots, the "wow" moment, a held ending or a loop. Times in seconds; shots cover the whole length without gaps. Every on-screen word written exactly (Arabic as it will appear).
Follow the owner's Higgsfield skills' workflow for a film (brief → passport → scenario with the shot table on the beat grid and the trigger map), and pick in "skillRefs" the files of theirs you will need open.${footagePart(b, false)}${footFrames.length ? `\nFRAMES OF THEIR VIDEO: ${footFrames.length} below (spread over it) — see the person, the room, the light and the colours; design the stage and the palette to sit with them.` : ""}

${openRefs([...ALWAYS_AT_PLAN, ...choicesRefs(choices)]).text}`,
    },
    ...footFrames.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `THEIR VIDEO, FRAME ${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
    ...refs.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `REFERENCE ${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, "مختبر الموشن · الخطة", parts, PLAN_SCHEMA, 12000, "high");
  // the picks ride with the plan, so writing and review see them too
  const plan = { ...readPlan(r.data, seconds, assets.map((a) => a.id), foot?.seconds), choices, ...(foot ? { narration: [] } : {}) };
  return { plan, say: text(r.data.say, 600), coins: r.coins, model: r.model };
}

/** 2 · WRITE: the scene program on the kit, from the approved plan (or a fix of the last one, from its errors). */
export async function labWrite(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const assets = assetsOf(b.assets);
  const plan = readPlan(b.plan, Number(b.seconds) || 15, assets.map((a) => a.id), footageOf(b)?.seconds);
  const f = frameOf(p);
  const previous = typeof b.code === "string" ? text(b.code, 140_000) : "";
  const errors = text(b.errors, 4000);
  // «خلفية شفافة»: the person wants the subject alone, to composite over something else — no fill at all
  const transparent = b.transparent === true;
  const bg = transparent
    ? "\nTRANSPARENT BACKGROUND (the person will composite this over something else): never call scene({ background: … }) with a colour, never fillRect / draw a shape, gradient or vignette across the whole K.W×K.H frame. Draw ONLY the subject itself (and its own shadow/glow if any) — everywhere else stays empty (alpha 0). A light contact shadow under a floating subject is fine; a filled backdrop is not."
    : "";
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the scene program below." : "WRITE the scene program for this approved plan."}
THE PLAN (approved by the person — follow it; improve only what the bar demands):
${planText(plan)}
FRAME: ${f.w}×${f.h} (${f.shape}) · FONTS loaded for you: K.fonts.head = ${plan.fonts.head}, K.fonts.body = ${plan.fonts.body}
ASSETS: ${assets.length ? assets.map((a) => `K.img("${a.id}") = «${a.name}» ${a.w}×${a.h}`).join("; ") : "none"}${bg}
${soundAsk(b).text}${voiceText(b) ? `
${voiceText(b)}` : ""}${footagePart(b, true)}
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the scene page — fix exactly this, keep everything else):\n${errors || "(no error text)"}` : `REFERENCE SCENES (the level of craft expected — learn the technique, never copy them):\n${exemplarsText()}`}
Write the COMPLETE program (it replaces the old one). duration = ${plan.seconds}, bpm = ${plan.bpm}. Use the palette's hex values. Cues on the changes. Make every frame worthy of the bar.

${openRefs([...new Set([...ALWAYS_AT_PLAN, ...knownRefs(plan.skillRefs)])]).text}`,
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
  const plan = readPlan(b.plan, Number(b.seconds) || 15, assets.map((a) => a.id), footageOf(b)?.seconds);
  const code = checkScene(b.code).code;
  if (!code) throw new UserError("ما وصلني المشهد.", 400);
  const sheets = pics(b.sheets, 3), stills = pics(b.stills, 6);
  if (!sheets.length && !stills.length) throw new UserError("ما وصلتني صور المشهد.", 400);
  const maxRounds = Math.max(1, Math.min(MAX_ROUNDS, Math.round(Number(b.maxRounds) || MAX_ROUNDS)));
  const round = Math.max(1, Math.min(maxRounds, Math.round(Number(b.round) || 1)));
  const times = (Array.isArray(b.times) ? b.times : []).map(Number).filter(Number.isFinite).slice(0, 6);
  const reviewOnly = b.reviewOnly === true;
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW ROUND ${round} of ${maxRounds}${round === maxRounds ? " (the last: identify the most important remaining corrections precisely)" : ""}. Be a HARSH motion director, not a proud author.
Below: ${sheets.length} contact sheet(s) (the frames of the whole piece in order, the time under each${sheets.length > 2 ? "; the LAST sheet is the shot changes, each as three frames — one before the cut, on it, one after: look there for doubled half-transparent text, a frame blended across a hard cut, a zoom that flips direction across the cut, a jump in position or a pop" : ""}) and ${stills.length} full-size still(s)${times.length ? ` at ${times.map((t) => `${t.toFixed(2)} s`).join(", ")}` : ""}, rendered from THE PROGRAM. Judge what you SEE, not what the code intends.
Score every criterion 1–10 (10 = indistinguishable from a top studio): ${RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}.
Check the blacklist. Name the 3 worst problems with their times and the exact fix. ${reviewOnly ? "Return code as an empty string. A separate writing step will apply your exact corrections; describe the fixes precisely and do not claim you applied them." : `If ANY score is below ${PASS}, return the COMPLETE revised program that fixes them (keep what already works); otherwise return code as an empty string.`}
Judge it also against the owner's Higgsfield skills (their non-negotiables, their motion grammar and their QA list).
THE PLAN: ${planText(plan)}${voiceText(b) ? `
${voiceText(b)}` : ""}${footageOf(b) ? `\nTHE PERSON'S VIDEO is in these frames: judge also the edit around them — their whole face always inside what is shown (never cut by an edge or a panel, never under text), the frame changing on their words and never the same way twice in a row, the explainers showing what they say at that second, them seen talking at least half the time, and the stage and the panels one designed world. A cut face or text over the face is a "clean" score of 4 or less.${footagePart(b, true)}` : ""}
Check the sound by reading sound() and the cues against what you see at those times (you cannot hear it): every big change has its sound on its frame, and the program has a sound() at all.
THE PROGRAM:
${code}

${openRefs([...new Set([...ALWAYS_AT_PLAN, ...knownRefs(plan.skillRefs)])]).text}`,
    },
    ...sheets.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `CONTACT SHEET ${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
    ...stills.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `STILL ${i + 1}${times[i] !== undefined ? ` (t = ${times[i].toFixed(2)} s)` : ""}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, `مختبر الموشن · مراجعة ${round}`, parts, REVIEW_SCHEMA, reviewOnly ? 12000 : outputBudget(b.model), "high");
  const review = readReview(r.data);
  const revised = !review.pass && typeof r.data.code === "string" && r.data.code.trim() ? checkScene(r.data.code) : null;
  return { review, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}
