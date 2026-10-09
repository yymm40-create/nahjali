// «الجواد الذكي!» | JAWAD AI — «التعديل الذكي» with continuity: how «جواد» writes the prompt of a part made again so
// the joins never show, above all when the person marked LESS than the generator's shortest clip (Seedance: 4 s) and
// the extra seconds have to be filled with the same moment. Pure; shared by the prompt writer's instructions, the
// checker that reads every prompt before it is sent (and sends it back with what is missing), the training bank
// and the tests.
//
// The loop around it (who talks to whom):
//   • A film's clip: سجاد hands it to حيدرة (it opens in «حيدرة كت»); حيدرة marks the seconds and writes what to
//     change; the pieces go to جواد, who makes them (a JAWAD AI job with the continuity references) and returns them
//     to حيدرة on the green track; حيدرة checks the joins and APPROVES; the approved version goes to سجاد, who puts it
//     in its place in the film (the generation's video, with the seconds that changed written to him).
//   • A video made directly in the studio: the same loop between حيدرة and جواد only.

import { CONTINUITY, continuityRanges, cutRange, type ContinuityRange } from "@/lib/jawad/smart-edit";

/** Seedance's clips: whole seconds, 4–15. */
export const EDIT_SECONDS = { min: 4, max: 15 } as const;

/** The method, as the prompt writer reads it (added to the smart edit's task for a part). */
export const CONTINUITY_METHOD = `CONTINUITY METHOD (a part made again — the joins must be invisible):
1. THE PIECE IS WHOLE SECONDS, never shorter than the generator's shortest clip (${EDIT_SECONDS.min} s). When the person marked less than that (1.5 s at 6.2–7.7, say), the site centres a ${EDIT_SECONDS.min}-second cut on it and moves it back inside the video (5.2–9.2), starting and ending on the original's own frames. You write for the WHOLE cut, not for the marked seconds alone.
2. THE FILL: the seconds the cut adds around the marked part carry the SAME MOMENT on at the original's pace — before the marked part: the original's own action at those seconds, flowing out of the first frame; the marked part: the change, written as simply how it happens; after it: the original's action continuing and landing exactly on the last frame. One natural, unhurried beat: no added events, no slow motion, no freeze, no held frame, no new cuts, no padding. Write the three spans with their exact seconds (a TIMING block is given to you: copy its numbers).
3. THE CONTINUITY REFERENCES, declared first in the prompt: @before is the original itself right before the cut — the new clip continues straight out of its last moment (identical framing, camera and lens, the same people in the same places, the same light, every motion carrying on in the same direction at the same speed, its sound running on); @after is the original right after the cut — the new clip ends flowing into its first moment. Say plainly at the start that they are references for continuity only, never copied, replayed or included. @sound_before / @sound_after: the sound continues through both joins — the same voices (a line in progress finishing naturally), ambience, effects and music, no new music or sudden silence.
4. THE LOCKS of the original stay: the style, each character's look and wardrobe, the place, the camera, the light, every spoken line word for word — their key words must be in the prompt.
5. POSITIVE ONLY: a fresh generation that never hears of the old one — never "previous", "again", "this time", "instead of", "unlike", "no longer", "don't", "doesn't", "avoid", "fix", "mistake", "error", "wrong", "correct the…"; never describe the unwanted result, not even to forbid it (naming it brings it back): write only what happens, concretely (contact points, directions, speeds, positions).
6. The clip's length in the prompt is the cut's seconds exactly; the other references are the original's characters and places by their @names, nothing invented.`;

/** The text of the flow for the people's assistants (حيدرة and سجاد) and for the knowledge text. */
export const EDIT_FLOW_AR = `مسار «التعديل الذكي»: مقطع من فيلم → سجاد يسلّمه لحيدرة في «حيدرة كت» → حيدرة يحدد الثواني ويكتب التعديلات → يرسلها لجواد فيصنعها (عمل في «الجواد الذكي!» مع مراجع الاستمرارية) ويرجّعها لحيدرة على المسار الأخضر → حيدرة يراجع الوصلات ويعتمد → النسخة المعتمدة تروح لسجاد فيحطها مكانها في الفيلم (مع ذكر الثواني اللي تغيّرت). فيديو من قسم الفيديو مباشرة: نفس المسار بين حيدرة وجواد فقط.`;

// ───────────────────────────── one edit, in numbers ─────────────────────────────

/** Everything the writer and the checker know about a part made again. */
export interface EditModel {
  /** the original video's length */
  videoSec: number;
  /** what the person marked */
  marked: { from: number; to: number };
  /** the cut (whole seconds, inside the video) */
  cut: { start: number; end: number; seconds: number };
  continuity: ContinuityRange[];
  /** sound references sent with the pieces */
  sounds: ("sound_before" | "sound_after")[];
  /** the original's other references by name */
  refs: string[];
  /** key words of the original's locks that must be in the prompt */
  lockWords: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const f1 = (n: number) => n.toFixed(1);

/** The model of an edit from what the person marked (null when the part can't be made). */
export function editModel(videoSec: number, marked: { from: number; to: number }, o: { sounds?: EditModel["sounds"]; refs?: string[]; lockWords?: string[]; continuity?: ContinuityRange[] } = {}): EditModel | null {
  const cut = cutRange(marked.from, marked.to, videoSec, EDIT_SECONDS.min, EDIT_SECONDS.max);
  if (!cut) return null;
  return { videoSec, marked: { from: r1(marked.from), to: r1(Math.min(marked.to, videoSec)) }, cut, continuity: o.continuity ?? continuityRanges(cut, videoSec), sounds: o.sounds ?? [], refs: o.refs ?? [], lockWords: o.lockWords ?? [] };
}

/** The name of a continuity reference (before, after; before1, before2 when there are several). */
export const continuityName = (r: ContinuityRange, all: ContinuityRange[]) => {
  const same = all.filter((x) => x.at === r.at);
  return same.length > 1 ? `${r.at}${same.indexOf(r) + 1}` : r.at;
};

/** The three spans of the cut: the seconds before the marked part, the marked part, the seconds after. */
export function spans(m: EditModel) {
  const before = r1(Math.max(0, m.marked.from - m.cut.start));
  const markedLen = r1(Math.min(m.cut.seconds, m.marked.to - m.marked.from));
  const after = r1(Math.max(0, m.cut.seconds - before - markedLen));
  return { before, marked: markedLen, after, fill: m.cut.seconds - markedLen >= 0.5 };
}

/** The TIMING block the writer is given (and whose numbers the checker looks for). */
export function timingBlock(m: EditModel): string {
  const s = spans(m);
  if (!s.fill) return "";
  return `TIMING — the generator's shortest clip is ${m.cut.seconds} s, longer than the ${f1(s.marked)} s the user marked. Fill the whole ${m.cut.seconds} s with ONE continuous moment of the same idea:
- ${f1(0)}–${f1(s.before)} s of the new clip (= ${f1(m.cut.start)}–${f1(m.marked.from)} s of the original): the same action, pace and camera as in the original at those seconds, flowing out of the first frame.
- ${f1(s.before)}–${f1(s.before + s.marked)} s (= the marked ${f1(m.marked.from)}–${f1(m.marked.to)} s): the part the user wants different, written as simply how it happens.
- ${f1(s.before + s.marked)}–${f1(m.cut.seconds)} s (= ${f1(m.marked.to)}–${f1(m.cut.end)} s of the original, ${f1(s.after)} s): the same action carries on as in the original and lands exactly on the last frame.
Describe it as one natural, unhurried beat at the original's speed: no added events, no slow-motion or frozen padding, no new cuts.`;
}

// ───────────────────────────── the checker ─────────────────────────────

/** Words that name the old video or the mistake (naming it brings it back). */
export const BANNED = ["previous video", "previous attempt", "the old video", "last time", "this time", "instead of", "unlike", "no longer", "don't", "doesn't", "do not", "does not", "avoid", "fix the", "fixed", "mistake", "error", "wrong", "correct the", "again", "glitch", "artifact"];
/** Padding that breaks one continuous beat. */
export const PADDING = ["slow motion", "slow-motion", "freeze frame", "frozen", "held frame", "cut to", "hard cut", "fade to black", "jump cut"];

export type EditProblemKind = "continuity_declaration" | "continuity_ref" | "unknown_ref" | "timing" | "banned" | "lock" | "landing" | "duration" | "padding" | "sound" | "empty";

export interface EditProblem {
  kind: EditProblemKind;
  /** what is told to the writer */
  text: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MENTION = /@([\p{L}\p{N}_\-]+)/gu;
// compiled once: the checker runs on a million prompts in the tests
const BANNED_RE = BANNED.map((w) => new RegExp(`(^|[^\\p{L}])${esc(w)}([^\\p{L}]|$)`, "u"));
const DUR_RE = new Map<number, RegExp>();
const durRe = (sec: number) => {
  let re = DUR_RE.get(sec);
  if (!re) {
    re = new RegExp(`(^|[^\\d.])${sec}(\\.0)?[ -]?(sec|seconds?)([^\\p{L}]|$)`, "u");
    DUR_RE.set(sec, re);
  }
  return re;
};
const WORDS_RE = /[^\p{L}\p{N}@]+/gu;

/**
 * Reads a prompt written for a part against its model: what is missing or forbidden, each with the line the writer
 * gets back. Empty when the prompt holds.
 */
export function checkEditPrompt(prompt: string, m: EditModel): EditProblem[] {
  const out: EditProblem[] = [];
  const p = prompt.trim();
  if (!p) return [{ kind: "empty", text: "The prompt is empty." }];
  const low = p.toLowerCase();
  const head = low.slice(0, 600);
  const contNames = m.continuity.map((r) => continuityName(r, m.continuity));
  const known = new Set([...contNames, ...m.sounds, ...m.refs].map((n) => n.toLowerCase()));

  if (contNames.length) {
    if (!(head.includes("continuity only") || head.includes("for continuity only") || head.includes("references for continuity"))) out.push({ kind: "continuity_declaration", text: "Say plainly at the START of the prompt that @before / @after are references for continuity only — never copied, replayed or included in the new clip." });
    for (const n of contNames) if (!low.includes(`@${n}`)) out.push({ kind: "continuity_ref", text: `Mention @${n} (the original video ${n.startsWith("before") ? "right BEFORE the cut: the new clip continues straight out of its last moment" : "right AFTER the cut: the new clip ends flowing into its first moment"}).` });
  }
  for (const mm of p.matchAll(MENTION)) {
    const n = mm[1].toLowerCase();
    if (!known.has(n)) out.push({ kind: "unknown_ref", text: `@${mm[1]} is not a reference of this request; use only: ${[...known].map((k) => `@${k}`).join(", ") || "none"}.` });
  }
  for (let i = 0; i < BANNED.length; i++) {
    if (low.includes(BANNED[i]) && BANNED_RE[i].test(low)) {
      out.push({ kind: "banned", text: `Never write "${BANNED[i]}": the generator never hears of the old video or the mistake. Write only what happens, positively.` });
      break;
    }
  }
  for (const w of PADDING) {
    if (low.includes(w)) {
      out.push({ kind: "padding", text: `No "${w}": one continuous beat at the original's speed, with no padding and no new cuts.` });
      break;
    }
  }
  const s = spans(m);
  if (s.fill) {
    const marks = [`${f1(0)}–${f1(s.before)} s`, `${f1(s.before)}–${f1(s.before + s.marked)} s`, `${f1(s.before + s.marked)}–${f1(m.cut.seconds)} s`].filter((x) => !/^0\.0–0\.0 s$|^(\d+\.\d)–\1 s$/.test(x));
    const missing = marks.filter((x) => !p.includes(x));
    if (missing.length) out.push({ kind: "timing", text: `Write the three spans of the cut with their exact seconds (${marks.join(", ")}): the seconds before the marked part carry the original's own action on, the marked part is the change, the seconds after carry on and land on the last frame.` });
    if (s.after > 0 && !(low.includes("last frame") || low.includes("final frame"))) out.push({ kind: "landing", text: "Say that the action carries on as in the original and lands exactly on the last frame (the frame after the cut)." });
    if (s.before > 0 && !(low.includes("first frame") || low.includes("straight out of") || low.includes("flowing out of"))) out.push({ kind: "landing", text: "Say that the clip opens flowing out of the first frame (the frame before the cut), the same action and pace." });
  } else if (contNames.some((n) => n.startsWith("before")) && !(low.includes("straight out of") || low.includes("flowing out of") || low.includes("first frame"))) {
    out.push({ kind: "landing", text: "Say that the clip continues straight out of the last moment before the cut." });
  }
  if (!durRe(m.cut.seconds).test(low)) out.push({ kind: "duration", text: `The clip is ${m.cut.seconds} seconds long: say so in words ("a ${m.cut.seconds}-second clip") (its length is the cut's, ${f1(m.cut.start)}–${f1(m.cut.end)} s of the original).` });
  if (m.sounds.length && !(low.includes("sound") && (low.includes("continu") || low.includes("running on") || low.includes("carries on")))) out.push({ kind: "sound", text: `The sound continues seamlessly through both joins (${m.sounds.map((x) => `@${x}`).join(" and ")}): the same voices, ambience, effects and music, no new music or sudden silence.` });
  const lowWords = m.lockWords.length ? ` ${low.replace(WORDS_RE, " ")} ` : "";
  const lost = m.lockWords.filter((w) => !lowWords.includes(` ${w.toLowerCase().replace(WORDS_RE, " ")} `));
  if (lost.length) out.push({ kind: "lock", text: `These key words of the original's locks are missing: ${lost.map((w) => `"${w}"`).join(", ")}. Put each back, keep everything else.` });
  return out;
}

// ───────────────────────────── the writer (the shape جواد learns) ─────────────────────────────

export interface EditScene {
  /** who and what, from the original (English, with @names) */
  subject: string;
  /** the original's action around the cut */
  action: string;
  /** the change, as simply how it happens */
  change: string;
  place: string;
  camera: string;
  light: string;
  style: string;
}

/** A full prompt for a part, in the shape every worked example has (the checker passes it by construction). */
export function writeEditPrompt(m: EditModel, sc: EditScene): string {
  const s = spans(m);
  const names = m.continuity.map((r) => continuityName(r, m.continuity));
  const before = names.filter((n) => n.startsWith("before"));
  const after = names.filter((n) => n.startsWith("after"));
  const lines: string[] = [];
  if (names.length) {
    lines.push(`${names.map((n) => `@${n}`).join(" and ")} ${names.length > 1 ? "are" : "is"} the original video itself, given as references for continuity only — never copied, replayed or included: this clip is only the new part in between.${before.length ? ` It continues straight out of the last moment of ${before.map((n) => `@${n}`).join(" and ")}: identical framing, camera position and lens, the same people in the same places, the same light, every motion carrying on in the same direction at the same speed.` : ""}${after.length ? ` It ends flowing into the first moment of ${after.map((n) => `@${n}`).join(" and ")}.` : ""}`);
  }
  if (m.sounds.length) lines.push(`The sound continues seamlessly through both joins, as in ${m.sounds.map((x) => `@${x}`).join(" and ")}: the same voices with any line in progress finishing naturally, the same ambience and effects, the same music running on, no new music and no sudden silence.`);
  lines.push(`${sc.style}, ${sc.camera}, ${sc.light}; ${sc.place}. A ${m.cut.seconds}-second clip (${f1(m.cut.start)}–${f1(m.cut.end)} s of the original), one continuous shot at the original's speed.`);
  if (s.fill) {
    const seg: string[] = [];
    if (s.before > 0) seg.push(`${f1(0)}–${f1(s.before)} s: ${sc.subject} ${sc.action}, the same action, pace and camera as the original at those seconds, flowing out of the first frame.`);
    seg.push(`${f1(s.before)}–${f1(s.before + s.marked)} s: ${sc.change}`);
    if (s.after > 0) seg.push(`${f1(s.before + s.marked)}–${f1(m.cut.seconds)} s: ${sc.subject} ${sc.action}, the same action carrying on as in the original, and it lands exactly on the last frame.`);
    lines.push(seg.join(" "));
    lines.push("One natural, unhurried beat at the original's pace: the same framing throughout, nothing added, nothing held.");
  } else {
    lines.push(`${sc.subject} ${sc.change} ${before.length ? "The clip opens flowing out of the first frame with the same action and pace, " : ""}${after.length ? "and lands exactly on the last frame." : "and holds the same framing to the end."}`);
  }
  if (m.lockWords.length) lines.push(`Kept exactly as in the original: ${m.lockWords.join(", ")}.`);
  return lines.join("\n\n");
}

// ───────────────────────────── the correction ─────────────────────────────

/** Sentences that name the old video or the mistake go; what the model needs is put back. The result passes the checker. */
export function repairEditPrompt(prompt: string, m: EditModel, sc: EditScene): string {
  const probs = checkEditPrompt(prompt, m);
  if (!probs.length) return prompt;
  const kinds = new Set(probs.map((p) => p.kind));
  // anything that breaks the shape beyond a missing line: rewritten from the model (the ideas of the scene kept)
  if (kinds.has("banned") || kinds.has("padding") || kinds.has("unknown_ref") || kinds.has("timing") || kinds.has("empty")) return writeEditPrompt(m, sc);
  let out = prompt;
  const names = m.continuity.map((r) => continuityName(r, m.continuity));
  if (kinds.has("continuity_declaration") || kinds.has("continuity_ref")) out = `${names.map((n) => `@${n}`).join(" and ")} ${names.length > 1 ? "are" : "is"} the original video itself, given as references for continuity only — never copied, replayed or included.\n\n${out}`;
  if (kinds.has("landing")) out += `\n\nThe clip opens flowing out of the first frame with the same action and pace, and lands exactly on the last frame.`;
  if (kinds.has("duration")) out += `\n\nA ${m.cut.seconds}-second clip (${f1(m.cut.start)}–${f1(m.cut.end)} s of the original).`;
  if (kinds.has("sound")) out += `\n\nThe sound continues seamlessly through both joins, as in ${m.sounds.map((x) => `@${x}`).join(" and ")}: the same voices, ambience, effects and music running on.`;
  if (kinds.has("lock")) {
    const lowWords = ` ${out.toLowerCase().replace(/[^\p{L}\p{N}@]+/gu, " ")} `;
    const lost = m.lockWords.filter((w) => !lowWords.includes(` ${w.toLowerCase()} `));
    out += `\n\nKept exactly as in the original: ${lost.join(", ")}.`;
  }
  return checkEditPrompt(out, m).length ? writeEditPrompt(m, sc) : out;
}

// ───────────────────────────── the training bank ─────────────────────────────

class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = (seed >>> 0) || 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }
  int(a: number, b: number) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
}

const SUBJECTS = ["the man in a white thobe", "the boy of ten in a blue shirt", "the man in a navy suit", "the chef in whites", "the old man in a grey bisht", "the young man in a black hoodie"];
/** The subject named with the original's own reference when there is one. */
const subjectOf = (base: string, refs: string[]) => (refs.length ? `${base} (the same person as in @${refs[0]})` : base);
const ACTIONS = ["walks along the corridor toward the window", "sits at the table and lifts the cup", "talks to the camera with one hand resting on the desk", "turns the pages of the book slowly", "steers the car with both hands on the wheel", "stands at the counter pouring tea into the glass"];
const CHANGES = [
  "his fingers wrap firmly around the cup's handle and lift it to his lips, the cup staying whole and in his hand.",
  "he looks straight into the lens and nods once, his eyes steady on the camera.",
  "the glass fills to two thirds, the tea's surface rising smoothly as he pours.",
  "his right hand closes the book gently with the cover facing up, the title readable.",
  "both hands stay on the wheel at ten and two, the road ahead steady through the windscreen.",
  "he steps over the threshold with his right foot first and keeps walking at the same pace.",
  "the phone stays flat on his open palm, screen up, while he keeps talking.",
  "he smiles with his mouth closed and tilts his head slightly to the right.",
];
const PLACES = ["a sunlit office with a glass wall", "a traditional majlis with red cushions", "a quiet kitchen in morning light", "the driver's seat of a moving car", "a café table by the window", "a hallway with wooden doors"];
const CAMERAS = ["a locked-off medium shot", "a slow push-in from medium to close", "a handheld medium close-up", "a static wide shot", "a gentle lateral dolly"];
const LIGHTS = ["soft window daylight from screen-left", "warm lamp light from screen-right", "overcast even daylight", "golden late-afternoon sun from screen-left"];
const STYLES = ["Photoreal, cinematic", "Photoreal, documentary", "Pixar-like 3D animation", "Photoreal, warm filmic grade"];
const LOCK_WORDS = ["white thobe", "red shemagh", "navy suit", "glass wall", "red cushions", "golden hour", "the cup", "the book", "the wheel", "Pixar-like", "screen-left", "lamp light", "morning light", "the window"];
const NOTES_AR = ["يده دخلت في الكوب", "عينه راحت بعيد عن الكاميرا", "الشاي انسكب برا الكاس", "الكتاب انقلب بالمقلوب", "يده نزلت من المقود", "تعثّر عند الباب", "الجوال اختفى من يده", "ابتسامته غريبة"];

export interface EditTrainingModel {
  id: string;
  /** what حيدرة wrote (Gulf Arabic) */
  note: string;
  model: EditModel;
  scene: EditScene;
  timing: string;
  prompt: string;
}

export const EDIT_MODELS = 1000;
let bank: EditTrainingModel[] | null = null;

/** A thousand worked edits (the same every time): most mark less than 4 s, so the fill is what they teach. */
export function editTrainingModels(count = EDIT_MODELS): EditTrainingModel[] {
  if (bank && count === EDIT_MODELS) return bank;
  const r = new Rng(77_101);
  const out: EditTrainingModel[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 10) {
    const videoSec = r.pick([4, 5, 6, 8, 8, 10, 10, 12, 15, 15]);
    const short = r.next() < 0.7;
    const len = short ? r1(0.4 + r.next() * 3.4) : r1(4 + r.next() * Math.min(6, videoSec - 4));
    const from = r1(r.next() * Math.max(0, videoSec - len));
    const marked = { from, to: r1(Math.min(videoSec, from + len)) };
    const sounds: EditModel["sounds"] = r.next() < 0.6 ? ["sound_before", "sound_after"] : r.next() < 0.5 ? ["sound_before"] : [];
    const refs = ["image1", ...(r.next() < 0.5 ? ["image2"] : [])];
    const lockWords = [...new Set(Array.from({ length: r.int(0, 4) }, () => r.pick(LOCK_WORDS)))];
    const model = editModel(videoSec, marked, { sounds, refs, lockWords });
    if (!model) continue;
    const scene: EditScene = { subject: subjectOf(r.pick(SUBJECTS), refs), action: r.pick(ACTIONS), change: r.pick(CHANGES), place: r.pick(PLACES), camera: r.pick(CAMERAS), light: r.pick(LIGHTS), style: r.pick(STYLES) };
    const prompt = writeEditPrompt(model, scene);
    out.push({ id: `edit-${out.length + 1}`, note: `${f1(marked.from)}–${f1(marked.to)} ث: ${r.pick(NOTES_AR)}`, model, scene, timing: timingBlock(model), prompt });
  }
  if (count === EDIT_MODELS) bank = out;
  return out;
}

/** The worked edits as the writer sees them in a turn (the closest by the size of the marked part and the cut). */
export function editModelsBrief(m: EditModel, k = 2): string {
  const s = spans(m);
  const list = [...editTrainingModels()]
    .map((e) => ({ e, d: Math.abs(spans(e.model).marked - s.marked) + Math.abs(e.model.cut.seconds - m.cut.seconds) * 0.5 + (e.model.sounds.length === m.sounds.length ? 0 : 1) }))
    .sort((a, b) => a.d - b.d || a.e.id.localeCompare(b.e.id))
    .slice(0, k)
    .map((x) => x.e);
  return `WORKED EDITS like this one (follow their shape; the content is this clip's own):\n${list.map((e, i) => `${i + 1}. Original ${e.model.videoSec} s; marked ${f1(e.model.marked.from)}–${f1(e.model.marked.to)} s; cut ${f1(e.model.cut.start)}–${f1(e.model.cut.end)} s (${e.model.cut.seconds} s); note: «${e.note}»\n   prompt: ${e.prompt.replace(/\n\n/g, " ")}`).join("\n")}`;
}

/** A random edit for the million tests: a video, a marked part (mostly under 4 s), references, locks, a scene. */
export function randomEdit(seed: number): { model: EditModel; scene: EditScene } | null {
  const r = new Rng(seed * 2654435761 + 12345);
  const videoSec = r.int(EDIT_SECONDS.min, 30);
  const len = Math.min(videoSec, r.next() < 0.6 ? r1(0.3 + r.next() * 3.6) : r1(EDIT_SECONDS.min + r.next() * (EDIT_SECONDS.max - EDIT_SECONDS.min)));
  const from = r1(r.next() * Math.max(0, videoSec - len));
  const sounds: EditModel["sounds"] = r.next() < 0.5 ? ["sound_before", "sound_after"] : r.next() < 0.5 ? ["sound_after"] : [];
  const refs = Array.from({ length: r.int(0, 3) }, (_, i) => `image${i + 1}`);
  const lockWords = [...new Set(Array.from({ length: r.int(0, 5) }, () => r.pick(LOCK_WORDS)))];
  const model = editModel(videoSec, { from, to: r1(from + len) }, { sounds, refs, lockWords });
  if (!model) return null;
  // sometimes the person's own yellow track: one or two pieces before, one after (each ≥ 2 s)
  if (r.next() < 0.3) {
    const cont: ContinuityRange[] = [];
    const b1 = r1(Math.max(0, model.cut.start - CONTINUITY.sec));
    if (model.cut.start - b1 >= CONTINUITY.minSec) cont.push({ at: "before", from: b1, to: model.cut.start });
    if (cont.length && b1 >= CONTINUITY.minSec && r.next() < 0.5) cont.unshift({ at: "before", from: r1(b1 - CONTINUITY.minSec), to: b1 });
    const a1 = r1(Math.min(videoSec, model.cut.end + CONTINUITY.sec));
    if (a1 - model.cut.end >= CONTINUITY.minSec) cont.push({ at: "after", from: model.cut.end, to: a1 });
    model.continuity = cont;
  }
  return { model, scene: { subject: subjectOf(r.pick(SUBJECTS), refs), action: r.pick(ACTIONS), change: r.pick(CHANGES), place: r.pick(PLACES), camera: r.pick(CAMERAS), light: r.pick(LIGHTS), style: r.pick(STYLES) } };
}

export const FAULTS = ["banned", "padding", "unknown_ref", "drop_timing", "drop_declaration", "wrong_duration", "drop_lock", "drop_sound", "drop_landing"] as const;
export type Fault = (typeof FAULTS)[number];

/** A prompt broken on purpose in one way (what a careless writer does), so the checker can be tested on it. */
export function breakPrompt(prompt: string, fault: Fault, m: EditModel): string {
  const s = spans(m);
  switch (fault) {
    case "banned":
      return `${prompt}\n\nThis time his hand doesn't go through the cup, unlike the previous video.`;
    case "padding":
      return `${prompt}\n\nThe last second plays in slow motion, then a freeze frame holds the pose.`;
    case "unknown_ref":
      return `${prompt}\n\nThe lamp from @image9 glows on the desk.`;
    case "drop_timing":
      return prompt.replace(/\d+\.\d–\d+\.\d s/g, "then");
    case "drop_declaration":
      return prompt.replace(/continuity only/gi, "reference").replace(/for continuity/gi, "as a reference");
    case "wrong_duration":
      return prompt.replace(new RegExp(`${m.cut.seconds}-second`, "g"), `${m.cut.seconds + 1}-second`);
    case "drop_lock":
      return m.lockWords.length ? prompt.replace(new RegExp(esc(m.lockWords[0]), "gi"), "that") : prompt;
    case "drop_sound":
      return prompt.replace(/The sound continues[^\n]*/g, "");
    case "drop_landing":
      return s.fill && s.after > 0 ? prompt.replace(/lands exactly on the last frame/g, "stops").replace(/last frame/g, "end") : prompt;
  }
}

/** Which problem kinds a fault must make the checker report (none when the fault had nothing to break). */
export function expectedKinds(fault: Fault, m: EditModel): EditProblemKind[] {
  const s = spans(m);
  switch (fault) {
    case "banned":
      return ["banned"];
    case "padding":
      return ["padding"];
    case "unknown_ref":
      return ["unknown_ref"];
    case "drop_timing":
      return s.fill ? ["timing"] : [];
    case "drop_declaration":
      return m.continuity.length ? ["continuity_declaration"] : [];
    case "wrong_duration":
      return ["duration"];
    case "drop_lock":
      return m.lockWords.length ? ["lock"] : [];
    case "drop_sound":
      return m.sounds.length ? ["sound"] : [];
    case "drop_landing":
      return s.fill && s.after > 0 ? ["landing"] : [];
  }
}

// ───────────────────────────── who decides the final prompt: جواد ─────────────────────────────

/**
 * «التعديل الذكي»: the edit goes from the editor (حيدرة كت) or the studio STRAIGHT to جواد — the studio's own assistant
 * (the one in the chat), with his own knowledge of the generators and the kinds of work — carrying the person's own
 * words, unaltered, and everything about the shot. جواد alone decides the final prompt: no step before him rewrites the
 * request, no step after him rewrites his prompt (only the website's mechanical rules send a fault back to him).
 * This is a REQUEST TYPE of his, like «video-transform»: the recipe that comes with the message.
 */
export const JAWAD_EDIT_IDENTITY = `REQUEST TYPE — «تعديل ذكي» (smart edit). The person pressed «توليد التعديل» on something JAWAD made, and the request reached you, «جواد», the studio's assistant, STRAIGHT from the editor (حيدرة كت) or the studio: nobody wrote, shortened, translated or "improved" it on the way. This request type overrides the chat habits above: no questions, no suggested replies, and no changes to the generator, the options or the references (the person's choices are binding) — the only thing you fill is the prompt (and "reply": one short line in Arabic saying what you did). You are given:
1. THE PERSON'S OWN WORDS, exactly as they typed them (with the seconds they marked, when they marked any);
2. THE WHOLE SHOT: the previous prompt (the person's, and as the generator received it), the settings, the frames of the video with their times, the references, the pieces of the video and its sound that carry on around the cut, and — for a film's clip — the film's story brief.
YOU alone decide the final prompt. The person's words say what must change (they win over everything else); everything they did not touch must stay as it is, so the result is the same work with only their change. Decide it yourself from all of that: the prompt you write is the one the generator receives, as you write it, and nobody rewrites it after you.`;

/** The person's words as the one who decides reads them: untouched, in the order they wrote them. */
export function personWordsText(notes: string, ranges: { from: number; to: number; note: string }[]): string {
  const marked = ranges.map((r) => `- From ${r.from.toFixed(1)} s to ${r.to.toFixed(1)} s${r.note ? `: ${r.note}` : ""}`);
  return [
    "THE PERSON'S OWN WORDS — exactly as they typed them; nobody changed, shortened, translated or improved them (build what they want into the new prompt as simply how the shot is; never mention the old video or what was wrong):",
    notes ? `<<<\n${notes}\n>>>` : "",
    ...marked,
  ].filter(Boolean).join("\n");
}

/** The shot's whole record for the one who decides: what was asked before, how it was made, how long it is. */
export function shotRecordText(o: { previous: string; settings: Record<string, unknown>; videoSec?: number; filmBrief?: string | null }): string {
  return [
    `THE WHOLE SHOT — what the person did NOT ask to change must stay exactly as it is.`,
    `PREVIOUS PROMPT (the ideas to keep; the old ${o.videoSec ? "video" : "result"} was made with it):\n<<<\n${o.previous}\n>>>`,
    `Original ${o.videoSec ? `video: ${o.videoSec.toFixed(1)} s, ` : ""}settings ${JSON.stringify(o.settings)}.`,
    o.filmBrief ? `FROM سجاد (the film's story consultant) — what this clip belongs to (story, characters, look, decisions):\n<<<\n${o.filmBrief.slice(0, 14_000)}\n>>>` : "",
  ].filter(Boolean).join("\n\n");
}
