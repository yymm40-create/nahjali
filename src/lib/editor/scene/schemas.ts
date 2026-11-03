// «مختبر الموشن» — the JSON shapes حيدرا ماكس answers in (plan, program, review, chat): the server asks Claude for them, as branches of ONE
// format (LAB_SCHEMA, below), and the agent's definition (config/editor/agent) is generated from them. Pure.

import { COVER_PASS, COVER_RUBRIC } from "./cover-rubric";
import { PASS, RUBRIC } from "./skill";

export const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "idea", "hook", "format", "wow", "intensity", "seconds", "bpm", "palette", "fonts", "shots", "assets", "pictures", "music", "narration", "skillRefs", "say"],
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
    pictures: {
      type: "array",
      description: "0–4 PICTURES SHOWN INSIDE the motion that nobody gave (a product photo, an object, a person or character, an illustration that appears as a picture in a shot). GPT Image 2 makes each one WITHOUT any writing. The motion itself and its whole foundation are CODE, always: never ask for a background, a backdrop, a texture, a world, a frame, type, shapes, particles or a transition — you draw all of that. Usually [].",
      items: { type: "object", additionalProperties: false, required: ["prompt", "name", "use", "aspect"], properties: { prompt: { type: "string", description: "English, detailed: subject, style matching the palette, lighting, composition, empty space where your type goes; never any text" }, name: { type: "string", description: "Arabic, 2–4 words" }, use: { type: "string", description: "where and how the scene uses it" }, aspect: { type: "string", enum: ["1:1", "9:16", "16:9", "4:5", "3:4", "4:3", "2:3", "3:2"] } } },
    },
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

export const CODE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["code", "notes"],
  properties: { code: { type: "string", description: "the complete scene program" }, notes: { type: "string", description: "to the person, Gulf Arabic, one sentence on what you built or fixed" } },
};

export const REVIEW_SCHEMA = {
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

export const CHAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "action", "brief", "code", "options", "search"],
  properties: {
    reply: { type: "string", description: "to the person, Gulf Arabic, short (1–3 sentences): what you understood and what you are doing, or the answer / the one question" },
    action: { type: "string", enum: ["none", "plan", "code", "cover", "render"], description: "none = only talk; plan = (re)write the scenario from `brief`; code = the COMPLETE revised program in `code`; cover = design the piece's cover now; render = make the final film now" },
    options: { type: "array", items: { type: "string" }, description: "0–4 short replies the person can press next (Gulf Arabic, 2–5 words each, e.g. «اعتمد وابنِ»، «أسرع شوي»، «صمّم الكفر»); [] when nothing obvious" },
    brief: { type: "string", description: "action plan: the complete creative brief from the whole conversation (the idea, length, tone, every word to show, colours, what to avoid); else empty" },
    code: { type: "string", description: "action code: the COMPLETE revised scene program (it replaces the old one); else empty" },
    search: { type: "string", description: "a web search to run FIRST, when the person asks you to look something up («ابحث»، «وش الترند») or your answer needs facts you don't have (a number, a brand's look, what is viral now) and no WEB RESEARCH is given yet: the query in a few words (action is then \"none\" and reply says you are searching); else empty" },
  },
};

/** A change as exact search/replace edits on the program shown (src/lib/patch.ts): the output is the dear part of a call,
 * and a note («خلّ اللون ذهبي») is a few lines of a 10–40k-token program. */
const EDITS = {
  type: "array",
  description: "exact search/replace edits on THE CURRENT PROGRAM, applied in order (each on the program as the edits before it left it): `old` is copied character for character from it (same spaces and indentation) and occurs in it EXACTLY ONCE — take a line or two around the spot when needed; `new` replaces it",
  items: { type: "object", additionalProperties: false, required: ["old", "new"], properties: { old: { type: "string" }, new: { type: "string" } } },
};

/** CHAT_SCHEMA when there is a program: a change comes back as `edits` (the whole program only when most of it changes). */
export const CHAT_EDIT_SCHEMA = {
  ...CHAT_SCHEMA,
  required: [...CHAT_SCHEMA.required, "edits"],
  properties: {
    ...CHAT_SCHEMA.properties,
    action: { ...CHAT_SCHEMA.properties.action, description: "none = only talk; plan = (re)write the scenario from `brief`; code = change the program: `edits` (or, only when the change rewrites most of it, the complete program in `code`); cover = design the piece's cover now; render = make the final film now" },
    edits: { ...EDITS, description: `action code: ${EDITS.description}; else []` },
    code: { type: "string", description: "action code, ONLY when the change rewrites most of the program (a new structure): the COMPLETE revised program, with edits []; else empty" },
  },
};

/** A fix of a program that threw, as `edits` on it (the whole program only when most of it changes). */
export const PATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["edits", "code", "notes"],
  properties: {
    edits: { ...EDITS, description: EDITS.description.replace("THE CURRENT PROGRAM", "THE PROGRAM") },
    code: { type: "string", description: "ONLY when the fix rewrites most of the program: the complete program, with edits []; else empty" },
    notes: CODE_SCHEMA.properties.notes,
  },
};

export const COVER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "code", "notes"],
  properties: {
    headline: { type: "string", description: "the cover's headline exactly as drawn (≤ 5 words), from the film's own words" },
    code: { type: "string", description: "the complete cover program (scene({ duration: 1, draw(K, t, ctx) { … } }))" },
    notes: { type: "string", description: "to the person, Gulf Arabic, one sentence: the idea of the cover" },
  },
};

export const COVER_REVIEW_SCHEMA = {
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

/**
 * ONE reply format for every call on the lab's system (the owner: «وحد الصيغة لكل الخطوات، نفس كلود»): a different
 * output format between calls is a different prompt cache, so the plan, the write, the review and the chat each wrote the
 * 37.8k-token system (and their fixed files) to the cache on their own and never read each other's. Now every step answers
 * `{ "result": … }` where `result` is one of the shapes above, told apart by its `kind` (written first) — the request names
 * the kind it wants. The shapes themselves are unchanged (the agent's definition is generated from them).
 */
type Shape = { type: string; additionalProperties: boolean; required: string[]; properties: Record<string, unknown> };
const branch = (kind: string, s: Shape) => ({
  ...s,
  required: ["kind", ...s.required],
  properties: { kind: { type: "string", enum: [kind] }, ...s.properties },
});
const oneOf = (kinds: Record<string, Shape>) => ({
  type: "object",
  additionalProperties: false,
  required: ["result"],
  properties: { result: { description: "your answer: the shape whose kind this request names", anyOf: Object.entries(kinds).map(([k, s]) => branch(k, s)) } },
});

/** The lab's steps by the kind of their answer: plan · write (the whole program) · patch (a fix as edits) · review · chat · chat_edit (a chat with a program: changes as edits). */
export const LAB_KINDS = { plan: PLAN_SCHEMA, write: CODE_SCHEMA, patch: PATCH_SCHEMA, review: REVIEW_SCHEMA, chat: CHAT_SCHEMA, chat_edit: CHAT_EDIT_SCHEMA };
export type LabKind = keyof typeof LAB_KINDS;
export const LAB_SCHEMA = oneOf(LAB_KINDS);

/** The cover's calls (their own system): the design (or its fix) and the review, one format the same way. */
export const COVER_KINDS = { cover: COVER_SCHEMA, cover_review: COVER_REVIEW_SCHEMA };
export type CoverKind = keyof typeof COVER_KINDS;
export const COVER_LAB_SCHEMA = oneOf(COVER_KINDS);

/**
 * The same `{ result }` reply with only the one branch asked: the safety net if the API ever refuses the shared format
 * (callClaudeJson's `schemaFallback`) — the step still works, only without sharing the cache with the others.
 */
export const soloSchema = (kind: LabKind | CoverKind) => oneOf({ [kind]: ({ ...LAB_KINDS, ...COVER_KINDS } as Record<string, Shape>)[kind] });

/** The line each request ends with: which shape to answer in. */
export const kindAsk = (kind: LabKind | CoverKind) => `ANSWER IN THE SHAPE result.kind = "${kind}" (your whole reply is {"result": {"kind": "${kind}", …}}).`;

/** The step's answer out of a `{ result }` reply, or null when it is missing or another kind than the one asked. */
export function resultOf<T>(data: unknown, kind: LabKind | CoverKind): T | null {
  const r = (data as { result?: unknown } | null | undefined)?.result;
  return r && typeof r === "object" && (r as { kind?: unknown }).kind === kind ? (r as T) : null;
}

/**
 * One call whose answer must be of `kind`: a reply of another kind is treated like a reply that is not the JSON asked
 * for — asked once more, then given up with the same error (claudeWhy says it to the person). `wasted`: the replies
 * thrown away (they were paid for). A cut reply (`partial`) and a continued one (`raw`, no format) are checked by the caller.
 */
export async function askKind<R extends { data: unknown; partial?: boolean }>(kind: LabKind | CoverKind, ask: () => Promise<R>, raw = false): Promise<R & { wasted: R[] }> {
  const first = await ask();
  if (raw || first.partial || resultOf(first.data, kind)) return { ...first, wasted: [] };
  const again = await ask();
  if (again.partial || resultOf(again.data, kind)) return { ...again, wasted: [first] };
  const got = (again.data as { result?: { kind?: unknown } } | null)?.result?.kind;
  throw new Error(`Claude reply was not the JSON asked for (kind ${String(got)} instead of ${kind})`);
}
