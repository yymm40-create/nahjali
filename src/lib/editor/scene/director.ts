// «مختبر الموشن» on the server — حيدرا ماكس as motion director and creative coder, in three calls to Claude (the person's
// model; Opus 5.5 by default): PLAN (the idea, the look and the shot list, from the brief, the references and the
// assets), WRITE (the scene program on the kit), REVIEW (he LOOKS at contact sheets and stills rendered in the
// person's browser, scores them like a harsh director and, below the bar, rewrites the program). The owner's motion
// skill is given word for word as the method; the lab's training (skill.ts) is the machine and the bar. Paid by real
// use like every robot turn. Rendering never happens here: the browser renders (scene-host.ts).

import { UserError } from "@/lib/api";
import { claudeModelOf } from "@config/claude-models";
import { callClaudeJson, callClaudeSearch, claudeCost, claudeWhy, type ClaudePart, type OnText } from "@/lib/film/anthropic";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { MOTION_DIRECTOR_SKILL_TEXT } from "@/lib/editor/motion-director-text";
import { claudeCharged, type Who } from "@/lib/editor/pricing";
import { stillOpen, type EditorProject } from "@/lib/editor/server";
import { checkScene, LAB_FONTS, readPlan, readReview, SECONDS, type LabPlan } from "./contract";
import { EXEMPLARS } from "./exemplars";
import { MAX_ROUNDS, MOTION_LAB_SKILL, PASS, RUBRIC } from "./skill";
import { CHAT_SCHEMA, CODE_SCHEMA, PLAN_SCHEMA, REVIEW_SCHEMA } from "./schemas";
import { continueAsk, effortAtMost, stitchCode } from "./resume";
import { ALWAYS_AT_PLAN, HF_LAB_TEXT, knownRefs, openRefs } from "./higgsfield";
import { choicesRefs, choicesText, readChoices } from "@config/editor/lab-options";
import { FOOTAGE_KIT_API, FOOTAGE_SKILL, footageText, readFootage, type FootageMeta } from "./footage";
import { readRefs, refsParts, refsText, researchText, SEARCH_SYSTEM, searchPrompt } from "./references";

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

/**
 * How long one request may read Claude's reply before it hands back what it has: the platform ends a request at
 * 800 s, counted from its start (`b.__at`, stamped by the route), and the step's own work before Claude is in that.
 */
const WINDOW_MS = 660_000;
type Asked<T> = { data: T; coins: number; model: string; partialRaw?: undefined } | { data?: undefined; coins: number; model: string; partialRaw: string; noProgress: boolean; effortUsed: string };

/**
 * One Claude step of the lab. A reply the request's time cannot hold comes back as `partialRaw` (the JSON written so far),
 * and the page sends the same request again with it: this one continues from its last character, so nothing is written
 * twice and no step ever starts again from nothing. `effortCap` (from the page, after a request went by in thought alone)
 * makes the model think less.
 */
async function ask<T>(who: Who, b: Record<string, unknown>, label: string, parts: ClaudePart[], schema: object, maxTokens: number, effort: "low" | "medium" | "high" | "xhigh" = "high", onText?: OnText): Promise<Asked<T>> {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرا ماكس غير مفعّل على الخادم.", 503);
  const written = typeof b.partialRaw === "string" ? b.partialRaw : "";
  const level = effortAtMost(effort, b.effortCap);
  const stopAt = (typeof b.__at === "number" ? b.__at : Date.now()) + WINDOW_MS;
  const turn: ClaudePart[] = written ? [...parts, { type: "text", text: continueAsk(written) }] : parts;
  // no deadline of the lab's own (the owner's rule): a step runs as long as the platform's route allows, then goes on in the next
  const r = await claudeCharged(
    who,
    b.model,
    label,
    () =>
      callClaudeJson<T>({ system: SYSTEM, turns: [{ role: "user", content: turn }], schema, maxTokens, effort: level, fallback: true, resume: { stopAt }, rawText: Boolean(written), onText }).catch((e) => {
        console.error("motion lab", label, e);
        throw new UserError(claudeWhy(e, "ما قدر حيدرا ماكس يكمل الموشن الحين. جرّب مرة ثانية.", who.email), 502);
      }),
    (x) => claudeCost(x.usage),
    undefined,
    "max",
  );
  if (r.partial) {
    const now = stitchCode(written, r.raw);
    return { partialRaw: now, noProgress: now.length <= written.length, effortUsed: level, coins: r.coins, model: r.model };
  }
  if (!written) return { data: r.data, coins: r.coins, model: r.model };
  const whole = stitchCode(written, r.raw);
  try {
    return { data: JSON.parse(whole) as T, coins: r.coins, model: r.model };
  } catch {
    console.error("motion lab", label, "continued reply is not JSON", whole.slice(-200));
    throw new UserError("ما قدرت أجمع رد حيدرا ماكس بعد ما انقطع. جرّب مرة ثانية.", 502);
  }
}

/** 1 · PLAN: the idea, the look and the shot list (the person approves it before any code). */
export async function labPlan(p: EditorProject, who: Who, b: Record<string, unknown>, onText?: OnText) {
  stillOpen(p);
  const foot = footageOf(b);
  // on the person's own video the idea may be left to him: the edit comes from what they say
  const brief = text(b.brief, 6000) || (foot ? "مونتاج موشن احترافي على كلامي في الفيديو: أنت تقرر متى أكون كامل الشاشة ومتى أصغر أو تنقسم الشاشة أو أختفي ويطلع شرح بالموشن، من كلامي نفسه." : "");
  if (brief.length < 3) throw new UserError("اكتب فكرة الموشن أول.");
  const seconds = foot ? foot.seconds : Math.min(SECONDS.max, Math.max(SECONDS.min, Math.round(Number(b.seconds) || 15)));
  const footFrames = foot ? pics(b.footage_frames, 4) : [];
  const assets = assetsOf(b.assets);
  const refs = readRefs(b);
  const research = researchText(b);
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
${refs.length ? refsText(refs) : "No references: avoid the safe default look; pick a viral format and push it."}${research ? `\n${research}` : ""}
${foot ? `"narration" is [] (their voice is the video's own sound). Every shot names its "frame". ` : soundAsk(b).voice ? `THE PERSON WILL RECORD THEIR OWN VOICE reading a narration YOU write: fill "narration" with the lines in order (${text(b.language, 40) || "Gulf Arabic"}, spoken words, short lines of one idea each, about 2 words a second so it is never rushed, from/to on the shots); the visuals are built to follow those words. ` : `"narration" is [] (no voice). `}${soundAsk(b).text}
Make it a studio piece: a hook on frame 1, one hero per shot, the beat grid, one object carrying across shots, the "wow" moment, a held ending or a loop. Times in seconds; shots cover the whole length without gaps. Every on-screen word written exactly (Arabic as it will appear).
Follow the owner's Higgsfield skills' workflow for a film (brief → passport → scenario with the shot table on the beat grid and the trigger map), and pick in "skillRefs" the files of theirs you will need open.${footagePart(b, false)}${footFrames.length ? `\nFRAMES OF THEIR VIDEO: ${footFrames.length} below (spread over it) — see the person, the room, the light and the colours; design the stage and the palette to sit with them.` : ""}

${openRefs([...ALWAYS_AT_PLAN, ...choicesRefs(choices)]).text}`,
    },
    ...footFrames.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `THEIR VIDEO, FRAME ${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
    ...refsParts(refs),
  ];
  const r = await ask<Record<string, unknown>>(who, b, "مختبر الموشن · الخطة", parts, PLAN_SCHEMA, 12000, "high", onText);
  if (r.partialRaw !== undefined) return r;
  // the picks ride with the plan, so writing and review see them too
  const plan = { ...readPlan(r.data, seconds, assets.map((a) => a.id), foot?.seconds), choices, ...(foot ? { narration: [] } : {}) };
  return { plan, say: text(r.data.say, 600), coins: r.coins, model: r.model };
}

/** 2 · WRITE: the scene program on the kit, from the approved plan (or a fix of the last one, from its errors). */
export async function labWrite(p: EditorProject, who: Who, b: Record<string, unknown>, onText?: OnText) {
  stillOpen(p);
  const assets = assetsOf(b.assets);
  const plan = readPlan(b.plan, Number(b.seconds) || 15, assets.map((a) => a.id), footageOf(b)?.seconds);
  const f = frameOf(p);
  const previous = typeof b.code === "string" ? b.code.trim() : "";
  const errors = text(b.errors, 4000);
  // «خلفية شفافة»: the person wants the subject alone, to composite over something else — no fill at all
  const transparent = b.transparent === true;
  // the references go with a first write too: the plan says what was taken, the pictures show how it looks
  const refs = previous ? [] : readRefs(b);
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
${refs.length ? `${refsText(refs)}\n` : ""}${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (from the scene page — fix exactly this, keep everything else):\n${errors || "(no error text)"}` : `REFERENCE SCENES (the level of craft expected — learn the technique, never copy them):\n${exemplarsText()}`}
Write the COMPLETE program (it replaces the old one). duration = ${plan.seconds}, bpm = ${plan.bpm}. Use the palette's hex values. Cues on the changes. Make every frame worthy of the bar.

${openRefs([...new Set([...ALWAYS_AT_PLAN, ...knownRefs(plan.skillRefs)])]).text}`,
    },
    ...refsParts(refs),
  ];
  const r = await ask<{ code: string; notes: string }>(who, b, previous ? "مختبر الموشن · تصليح" : "مختبر الموشن · كتابة المشهد", parts, CODE_SCHEMA, outputBudget(b.model), previous ? "medium" : "high", onText);
  if (r.partialRaw !== undefined) return r;
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
  const maxRounds = Math.max(1, Math.round(Number(b.maxRounds) || MAX_ROUNDS));
  const round = Math.max(1, Math.round(Number(b.round) || 1));
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
  const r = await ask<Record<string, unknown>>(who, b, `مختبر الموشن · مراجعة ${round}`, parts, REVIEW_SCHEMA, reviewOnly ? 12000 : outputBudget(b.model), "high");
  if (r.partialRaw !== undefined) return r;
  const review = readReview(r.data);
  const revised = !review.pass && typeof r.data.code === "string" && r.data.code.trim() ? checkScene(r.data.code) : null;
  return { review, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}

/**
 * 0 · CHAT: the lab as a conversation. The person writes what they want — a new piece, a change («كبّر الشعار»،
 * «خلّ اللون ذهبي»، «أسرع شوي»), a picture they attached (a logo, a product) — and حيدرا ماكس answers and decides: talk only,
 * (re)plan from a brief he writes out of the whole conversation, or change the program himself (the page runs it,
 * fixes any error with him, and shows it).
 */
export async function labChat(p: EditorProject, who: Who, b: Record<string, unknown>, onText?: OnText) {
  stillOpen(p);
  const message = text(b.message, 4000);
  if (!message) throw new UserError("اكتب لحيدرا ماكس وش تبي.");
  const assets = assetsOf(b.assets);
  const hasPlan = Boolean(b.plan && typeof b.plan === "object");
  const foot = footageOf(b);
  const plan = hasPlan ? readPlan(b.plan, Number(b.seconds) || 15, assets.map((a) => a.id), foot?.seconds) : null;
  const code = typeof b.code === "string" ? checkScene(b.code).code : "";
  const history = (Array.isArray(b.history) ? b.history : []).slice(-20).map((m) => {
    const o = (m ?? {}) as Record<string, unknown>;
    return `${o.role === "assistant" ? "حيدرا ماكس" : "الشخص"}: ${text(o.text, 1500)}`;
  });
  const params = (b.params && typeof b.params === "object" ? b.params : {}) as Record<string, unknown>;
  const f = frameOf(p);
  const refs = readRefs(b);
  const research = researchText(b);
  // the person's own video(s) loaded in the conversation (from the timeline or their device)
  const attached = (Array.isArray(b.attached_video) ? b.attached_video : []).slice(0, 6).map((v) => {
    const o = (v ?? {}) as Record<string, unknown>;
    return `«${text(o.name, 60)}» (${Math.round((Number(o.seconds) || 0) * 10) / 10} s)`;
  });
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `THE LAB IS A CONVERSATION. The person talks to you like to a motion designer sitting next to them. Read the whole conversation and their new message, then decide ONE action:
- "plan": there is no piece yet (and the message says what they want — go, never interview them; ask only if you truly cannot start), OR they ask for a different idea, structure, length or style → write "brief": the complete creative brief from the WHOLE conversation (everything they asked so far, in their words and yours).
- "code": there is a piece and they ask for a change that keeps its idea (a colour, a word, a size, a speed, an element added or removed, a logo or picture they attached placed in it, the sound, a moment moved) → return the COMPLETE revised program in "code", changing only what they asked and keeping everything else exactly as it is (timing, params, cues, sound).
- "cover": there is a piece and they ask for its cover / thumbnail («سو كفر»، «ثمبنيل») → the lab designs it next (any words they want on it go in "brief").
- "render": there is a piece and they ask to export / render / put it on the timeline («صدّره»، «رندر»، «نزّله») → the lab renders the final film.
- "none": a question, a thanks, or nothing to change → just "reply".
THE WAY OF WORKING (the owner's skills): the scenario comes first and is approved before any code; after it every note changes ONLY what the person named and keeps everything else as it is; a version the person has seen is never overwritten (the lab keeps each one).
"reply" is always filled, in Gulf Arabic, short and warm, never technical (no code words).
FRAME: ${f.w}×${f.h} (${f.shape})
${attached.length ? `THE PERSON LOADED THEIR OWN VIDEO IN THIS CONVERSATION: ${attached.join("، ")}. It is what they mean by «الفيديو» / «مقطعي». When they ask for a piece (or just say go), the action is \"plan\" and the piece is built ON that video (the lab learns what they say in it and the plan frames it); never ask them to attach it again, never plan a piece that ignores it. When the message is only «اكتب السيناريو» or «مونتاج موشن احترافي على كلامي», write the brief as that: a professional motion edit on their video, decided from what they say in it.\n` : ""}PICTURES THE SCENE CAN DRAW (by id, with K.img / K.picture): ${assets.length ? assets.map((a) => `${a.id} = «${a.name}» ${a.w}×${a.h}`).join("; ") : "none"} — a picture they just attached is listed here; when they say «هذا الشعار» / «حط اللوقو», it is the newest one: draw the REAL picture (K.picture), never redraw a logo yourself.
${refs.length ? `${refsText(refs)} When they say «زي المرجع» / «مثل الفيديو», they mean these.\n` : ""}${research ? `${research}\n` : "You can search the web: put a query in \"search\" (see its description) and the lab searches, then asks you again with the results.\n"}${history.length ? `THE CONVERSATION SO FAR:\n${history.join("\n")}\n` : ""}THEIR NEW MESSAGE: ${message}
${plan ? `THE CURRENT PLAN: ${planText(plan)}` : "There is no plan yet."}
${Object.keys(params).length ? `THE VALUES THEY EDITED (params → their value; keep them unless they ask otherwise): ${JSON.stringify(params).slice(0, 3000)}` : ""}
${code ? `THE CURRENT PROGRAM:\n${code}` : ""}${footagePart(b, Boolean(code))}${code ? `\n\n${SCENE_CONTRACT_NOTE}` : ""}`,
    },
    ...refsParts(refs),
  ];
  const r = await ask<{ reply: string; action: string; brief: string; code: string; options?: unknown; search?: unknown }>(who, b, "مختبر الموشن · محادثة", parts, CHAT_SCHEMA, code ? outputBudget(b.model) : 8000, code ? "high" : "medium", onText);
  if (r.partialRaw !== undefined) return r;
  // a search he asked for (only once per message: with the results in hand he answers)
  const search = research ? "" : text(r.data.search, 300);
  let action = search ? "none" : ["plan", "code", "cover", "render"].includes(r.data.action) ? r.data.action : "none";
  // a change asked with no piece yet is a plan (and so is a cover or a render of nothing); a program that breaks the
  // machine's rules goes back as an error to fix
  if ((action === "code" || action === "cover" || action === "render") && !code) action = "plan";
  const revised = action === "code" ? checkScene(r.data.code) : null;
  if (action === "code" && !revised?.code) action = "none";
  return {
    reply: text(r.data.reply, 1200) || "تمام.",
    action,
    brief: action === "plan" ? text(r.data.brief, 6000) || message : action === "cover" ? text(r.data.brief, 1200) : "",
    options: (Array.isArray(r.data.options) ? r.data.options : []).map((o) => text(o, 40)).filter(Boolean).slice(0, 4),
    code: revised?.code ?? "",
    problems: revised?.problems ?? [],
    search,
    coins: r.coins,
    model: r.model,
  };
}

/**
 * «🌐 ابحث»: a real web search for the lab (Anthropic's server-side search, like Claude's own), when the person asks
 * him to look something up or his answer needs fresh facts. The page brings what it found to the next step.
 */
export async function labSearch(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  if (!text(b.query, 1500)) throw new UserError("اكتب وش تبي حيدرا ماكس يدوّر عليه.");
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرا ماكس غير مفعّل على الخادم.", 503);
  const r = await claudeCharged(
    who,
    b.model,
    "مختبر الموشن · بحث في الإنترنت",
    () =>
      callClaudeSearch({ system: SEARCH_SYSTEM, prompt: searchPrompt(b), maxUses: 5, maxTokens: 5000 }).catch((e) => {
        console.error("motion lab search", e);
        throw new UserError(claudeWhy(e, "ما قدر حيدرا ماكس يبحث في الإنترنت الحين. جرّب بعد شوي.", who.email), 502);
      }),
    (x) => x.usd,
  );
  return { text: text(r.text, 6000), sources: r.sources, coins: r.coins, model: r.model };
}

/** What a revised program must keep (said briefly; the full contract is in the system prompt). */
const SCENE_CONTRACT_NOTE = `Keep the machine's rules (a frame depends only on t; every shown word and the main colours are params read with K.p; the same duration unless asked; cues and sound() kept in step with what moves).`;
