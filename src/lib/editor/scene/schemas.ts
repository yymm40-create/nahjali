// «مختبر الموشن» — the JSON shapes حيدرا ماكس answers in (plan, program, review, chat): the server asks Claude for them and the agent's
// definition (config/editor/agent) is generated from them. Pure.

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
