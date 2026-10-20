// «🎬 مختبر الموشن» · «🖼️ الكفر» — حيدرة designs the piece's cover (an Instagram reel cover, or a YouTube thumbnail for a
// landscape project) IN CODE on the same scene machine, by the owner's cover skill word for word (SKILL.md + its rules
// file): everything that matters inside the centre 1:1 square, a headline of ≤ 5 words that reads at the profile grid's
// 12 %, the person's own face from the film never redrawn and never covered. The page draws it, makes the grid-size and
// crop previews, and he looks at them, scores them and rewrites until it reads. Paid by real use like every robot turn.

import { UserError } from "@/lib/api";
import { callClaudeJson, claudeCost, claudeWhy, type ClaudePart, type OnText } from "@/lib/film/anthropic";
import { FONT_BY_ID } from "@/lib/editor/fonts";
import { COVER_RULES_TEXT, COVER_SKILL_TEXT } from "@/lib/editor/cover-skill-text";
import { claudeCharged, type Who } from "@/lib/editor/pricing";
import { stillOpen, type EditorProject } from "@/lib/editor/server";
import { checkScene, LAB_FONTS } from "./contract";
import { SCENE_CONTRACT } from "./skill";
import { COVER_PASS, COVER_ROUNDS, COVER_RUBRIC, type CoverRubricId } from "./cover-rubric";

export { COVER_PASS, COVER_ROUNDS, COVER_RUBRIC };



const SYSTEM = `You are «حيدرة», the motion director and creative coder of «حيدرة كت». Now you design the COVER of a piece you made in the motion lab — in CODE, on the same scene machine (one program, drawn at t = 0). Your method is the owner's cover skill below, word for word, with its rules file.

THE OWNER'S COVER SKILL — between <cover-skill> tags, as he wrote it. Use it as written: its question about the photo, its structure (the safe square, the headline from the video's own words, the logos only when the story is «from X to Y»), its sizes and its style rules. It was written for a machine with a terminal and Python scripts (28_cover.py, 33_thumb.py, 34_phone_preview.py, _cutout.py): HERE THE LAB IS THAT MACHINE — your program is the cover, the page draws it at the project's size, the phone preview (the 12 % picture and the crops) is made for you and shown to you at review. Skip only its script mechanics; everything else applies. Its default cream background (#F0EEE6) gives way to the piece's own palette when the piece has one (the brand leads).
<cover-skill>
${COVER_SKILL_TEXT}
</cover-skill>
<cover-rules>
${COVER_RULES_TEXT}
</cover-rules>

THE PERSON'S PHOTO comes from the film itself: its frames are given to you as pictures (K.img("f1"), "f2", "f3" — K.picture(ctx, id, x, y, w, h, { fit: "cover" }) crops them). Never redraw a person; never put a word on a face; take the frame where the face is biggest and clearest. When the film has no person, the cover is its strongest frame or its hero element, built big.

${SCENE_CONTRACT}

THE COVER'S OWN RULES OVER THE SCENE CONTRACT: duration is 1 and only t = 0 is drawn (no motion, no cues, no sound()); draw the whole frame K.W × K.H; text sizes in px of the real frame (K.W wide), never smaller than the skill's minimums.`;

const COVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "code", "notes"],
  properties: {
    headline: { type: "string", description: "the cover's headline exactly as drawn (≤ 5 words), from the film's own words" },
    code: { type: "string", description: "the complete cover program (scene({ duration: 1, draw(K, t, ctx) { … } }))" },
    notes: { type: "string", description: "to the person, Gulf Arabic, one sentence: the idea of the cover" },
  },
};

const REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scores", "problems", "verdict", "code"],
  properties: {
    scores: { type: "object", additionalProperties: false, required: COVER_RUBRIC.map((r) => r.id), properties: Object.fromEntries(COVER_RUBRIC.map((r) => [r.id, { type: "integer", description: r.en }])) },
    problems: { type: "array", items: { type: "string" }, description: "what is wrong, most important first (≤ 4)" },
    verdict: { type: "string", description: "to the person, Gulf Arabic, one sentence: how it reads and what you changed" },
    code: { type: "string", description: `the COMPLETE revised cover program when any score is below ${COVER_PASS}; empty otherwise` },
  },
};

const jpeg = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < 1_400_000 ? v : null);
const pics = (v: unknown, max: number) => (Array.isArray(v) ? v : []).map(jpeg).filter((x): x is string => Boolean(x)).slice(0, max);
const text = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);
const font = (v: unknown, d: string) => (typeof v === "string" && LAB_FONTS.includes(v) ? v : d);

function frameOf(p: EditorProject) {
  const w = p.timeline.width || 1080, h = p.timeline.height || 1920;
  const portrait = h > w * 1.2;
  return { w, h, kind: portrait ? `an Instagram REEL COVER ${w}×${h} (9:16; the safe 1:1 square is y ${Math.round((h - w) / 2)}–${Math.round((h + w) / 2)})` : `a YouTube THUMBNAIL ${w}×${h} (16:9; keep the bottom-right ${Math.round(w * 0.16)}×${Math.round(h * 0.13)} empty for the duration)` };
}

async function ask<T>(who: Who, model: unknown, label: string, parts: ClaudePart[], schema: object, maxTokens: number, onText?: OnText) {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);
  return claudeCharged(
    who,
    model,
    label,
    () =>
      callClaudeJson<T>({ system: SYSTEM, turns: [{ role: "user", content: parts }], schema, maxTokens, effort: "high", fallback: true, onText }).catch((e) => {
        console.error("motion lab cover", label, e);
        throw new UserError(claudeWhy(e, "ما قدر حيدرة يكمل الكفر الحين. جرّب مرة ثانية.", who.email), 502);
      }),
    (x) => claudeCost(x.usage),
  );
}

/** What the cover is for: the film's idea, its words and its look (from the plan), and what the person asked. */
function briefOf(b: Record<string, unknown>) {
  const plan = (b.plan ?? {}) as Record<string, unknown>;
  const fonts = (plan.fonts ?? {}) as Record<string, unknown>;
  const shots = (Array.isArray(plan.shots) ? plan.shots : []).slice(0, 30).map((s) => text((s as Record<string, unknown>)?.text, 160)).filter(Boolean);
  return {
    head: font(fonts.head, "alexandria"),
    body: font(fonts.body, "ibm-plex-sans-arabic"),
    text: `THE FILM: «${text(plan.title, 80)}» — ${text(plan.idea, 400)}
ITS HOOK: ${text(plan.hook, 300)}
ITS WORDS ON SCREEN (the headline comes from these or from what the person says): ${shots.length ? shots.map((s) => `«${s}»`).join(" · ") : "(none)"}
ITS PALETTE: ${JSON.stringify(plan.palette ?? {})}
THE PERSON'S WISH FOR THE COVER: ${text(b.wish, 1200) || "(none — choose the strongest hook yourself)"}`,
  };
}

/** 1 · the cover program (from the film's frames and the plan), or a fix of the last one from its error. */
export async function labCoverWrite(p: EditorProject, who: Who, b: Record<string, unknown>, onText?: OnText) {
  stillOpen(p);
  const frames = pics(b.frames, 3);
  const f = frameOf(p);
  const brief = briefOf(b);
  const previous = typeof b.code === "string" ? b.code.trim() : "";
  const errors = text(b.errors, 4000);
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `${previous ? "FIX the cover program below." : "DESIGN THE COVER of this film."} It is ${f.kind}.
${brief.text}
FONTS loaded for you: K.fonts.head = ${brief.head} (${FONT_BY_ID.get(brief.head)?.ar ?? ""}), K.fonts.body = ${brief.body}
THE FILM'S FRAMES you may draw: ${frames.length ? frames.map((_, i) => `K.img("f${i + 1}")`).join(", ") + " (shown below, in order)" : "none — build it from the film's look"}
${previous ? `THE PROGRAM:\n${previous}\n\nWHAT WENT WRONG (fix exactly this, keep everything else):\n${errors || "(no error text)"}` : "Write the COMPLETE program."}`,
    },
    ...frames.flatMap((d, i): ClaudePart[] => [{ type: "text", text: `FRAME f${i + 1}:` }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
  const r = await ask<{ headline: string; code: string; notes: string }>(who, b.model, previous ? "مختبر الموشن · تصليح الكفر" : "مختبر الموشن · الكفر", parts, COVER_SCHEMA, 48_000, onText);
  const chk = checkScene(r.data.code);
  return { code: chk.code, problems: chk.problems, headline: text(r.data.headline, 80), notes: text(r.data.notes, 600), coins: r.coins, model: r.model };
}

export interface CoverReview {
  scores: Record<CoverRubricId, number>;
  problems: string[];
  verdict: string;
  pass: boolean;
  low: number;
}
/** The cover's scores, bounded; it passes only when every criterion is ≥ COVER_PASS. */
export function readCoverReview(raw: unknown): CoverReview {
  const o = (raw ?? {}) as Record<string, unknown>;
  const sc = (o.scores ?? {}) as Record<string, unknown>;
  const scores = Object.fromEntries(COVER_RUBRIC.map((r) => [r.id, Math.min(10, Math.max(1, Math.round(Number(sc[r.id]) || 1)))])) as Record<CoverRubricId, number>;
  const low = Math.min(...Object.values(scores));
  return { scores, problems: (Array.isArray(o.problems) ? o.problems : []).map((x) => text(x, 300)).filter(Boolean).slice(0, 4), verdict: text(o.verdict, 600), pass: low >= COVER_PASS, low };
}

/** 2 · he looks at the cover as drawn (full, at the grid's 12 % and in its crops), scores it and rewrites it below the bar. */
export async function labCoverReview(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const code = checkScene(b.code).code;
  if (!code) throw new UserError("ما وصلني الكفر.", 400);
  const [full, tiny, ...crops] = pics(b.views, 4);
  if (!full) throw new UserError("ما وصلتني صورة الكفر.", 400);
  const f = frameOf(p);
  const brief = briefOf(b);
  const round = Math.max(1, Math.round(Number(b.round) || 1));
  const parts: ClaudePart[] = [
    {
      type: "text",
      text: `REVIEW THE COVER, round ${round} of ${COVER_ROUNDS}. Be the harsh designer the skill asks for. It is ${f.kind}.
${brief.text}
Below: the cover at full size${tiny ? ", then the SAME cover at the profile grid's size (12 % — what a person really sees)" : ""}${crops.length ? ", then its crops (1:1 and 3:4 from the centre)" : ""}. Judge what you SEE.
Score every criterion 1–10: ${COVER_RUBRIC.map((r) => `${r.id}: ${r.en}`).join(" | ")}.
If ANY score is below ${COVER_PASS}, return the COMPLETE revised program that fixes it (keep what already works); otherwise code is empty.
THE PROGRAM:
${code}`,
    },
    { type: "text", text: "FULL SIZE:" },
    { type: "image64", data: full, mediaType: "image/jpeg" },
    ...(tiny ? ([{ type: "text", text: "AT THE GRID'S SIZE (12 %):" }, { type: "image64", data: tiny, mediaType: "image/jpeg" }] as ClaudePart[]) : []),
    ...crops.flatMap((d, i): ClaudePart[] => [{ type: "text", text: i === 0 ? "CROP 1:1:" : "CROP 3:4:" }, { type: "image64", data: d, mediaType: "image/jpeg" }]),
  ];
  const r = await ask<Record<string, unknown>>(who, b.model, `مختبر الموشن · مراجعة الكفر ${round}`, parts, REVIEW_SCHEMA, 48_000);
  const review = readCoverReview(r.data);
  const revised = !review.pass && typeof r.data.code === "string" && r.data.code.trim() ? checkScene(r.data.code) : null;
  return { review, code: revised?.ok ? revised.code : "", problems: revised && !revised.ok ? revised.problems : [], coins: r.coins, model: r.model };
}
