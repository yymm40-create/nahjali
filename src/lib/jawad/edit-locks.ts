// «التعديل الذكي» — the original's locks: what must not move — the look, each character's identity and wardrobe, the
// place, the camera, the light, the spoken lines — minus what the person asked to change. جواد declares them in the
// same answer as the prompt he writes (he is the one who decides what stays), and the prompt is checked against them
// (each lock's check words must be in it). Pure, no I/O.

export const LOCK_KINDS = ["style", "character", "wardrobe", "place", "camera", "lighting", "dialogue", "sound", "timing", "other"] as const;
export type LockKind = (typeof LOCK_KINDS)[number];

export interface EditLock {
  kind: LockKind;
  /** The constraint, in English, concrete (e.g. "@omar wears a white thobe and a red shemagh"). */
  keep: string;
  /** 1–3 words or short phrases, in English, copied from the previous prompt, that the new prompt must contain. */
  check: string[];
}

export const LOCKS_MAX = 14;

/**
 * What جواد is asked to declare, in the same answer as the prompt, about what his prompt carries over from the original
 * (no separate pass before it: the one who writes the prompt is the one who decides what stays). Each declared lock is
 * then checked against the prompt by its key words.
 */
export const KEPT_RULES = `Besides the prompt, fill "kept": the LOCKS — the important constraints of the ORIGINAL that your prompt carries over, so the edit looks like the same work (at most ${LOCKS_MAX}, the most important first):
- style: the visual style / look / render (e.g. "Pixar-like 3D animation, soft pastel palette").
- character: each character's identity — the @name and how they look (age, face, hair, build).
- wardrobe: what each one wears, colours included.
- place: the setting and its key props.
- camera: framing, lens, angle and movement.
- lighting: the light and time of day, colour temperature.
- dialogue: each spoken line, word for word as written in the previous prompt, and who says it.
- sound: the ambience or music when the prompt sets it.
- timing: the order of the action beats.
- other: anything else the brief or the prompt insists on (an aspect, a rule of the film).
Rules for "kept":
- Only what the previous prompt or the film's brief actually says. Never invent.
- Leave out every lock the person asked to change (their words win), and every part of a lock they changed.
- "keep" is one short concrete English sentence. "check" is 1–3 distinctive words or short phrases (2–4 words) copied EXACTLY from the previous prompt (same spelling, case-insensitive) that your new prompt contains — names, colours, nouns; for dialogue, a few words of the line itself. Never a whole sentence, never a word the person asked to change.`;

export const LOCKS_SCHEMA = {
  type: "object",
  properties: {
    locks: {
      type: "array",
      items: {
        type: "object",
        properties: { kind: { type: "string", enum: [...LOCK_KINDS] }, keep: { type: "string" }, check: { type: "array", items: { type: "string" } } },
        required: ["kind", "keep", "check"],
        additionalProperties: false,
      },
    },
  },
  required: ["locks"],
  additionalProperties: false,
};

const norm = (t: string) => t.toLowerCase().replace(/[ً-ْٰ]/g, "").replace(/[^\p{L}\p{N}@]+/gu, " ").trim();

/**
 * Claude's answer made safe: known kinds only, a short "keep", and only check words that really are in the previous
 * prompt (a check word the prompt never had could never be checked fairly). A lock without a usable check word is
 * kept for the writer but not checked.
 */
export function readLocks(raw: unknown, previous: string): EditLock[] {
  const list = (raw as { locks?: unknown } | null)?.locks;
  if (!Array.isArray(list)) return [];
  const prev = ` ${norm(previous)} `;
  const out: EditLock[] = [];
  for (const x of list) {
    const l = (x ?? {}) as Record<string, unknown>;
    const kind = LOCK_KINDS.includes(l.kind as LockKind) ? (l.kind as LockKind) : "other";
    const keep = typeof l.keep === "string" ? l.keep.replace(/\s+/g, " ").trim().slice(0, 300) : "";
    if (!keep) continue;
    const check = (Array.isArray(l.check) ? l.check : [])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim().slice(0, 60))
      .filter((c) => norm(c).length >= 2 && prev.includes(` ${norm(c)} `))
      .slice(0, 3);
    out.push({ kind, keep, check });
    if (out.length >= LOCKS_MAX) break;
  }
  return out;
}

/** The locks as the prompt writer reads them. */
export function locksText(locks: EditLock[]): string {
  if (!locks.length) return "";
  return `LOCKS OF THE ORIGINAL — the new prompt MUST keep every one of these exactly (they are what makes it the same work; the user did not ask to change them). Carry each into the prompt in your own words, keeping its key words${locks.some((l) => l.kind === "dialogue") ? " and every spoken line word for word" : ""}:\n${locks.map((l, i) => `${i + 1}. [${l.kind}] ${l.keep}${l.check.length ? ` (key words: ${l.check.map((c) => `"${c}"`).join(", ")})` : ""}`).join("\n")}`;
}

/** The locks whose key words are missing from the new prompt (all of a lock's check words must be there). */
export function missingLocks(prompt: string, locks: EditLock[]): EditLock[] {
  const text = ` ${norm(prompt)} `;
  return locks.filter((l) => l.check.length && !l.check.every((c) => text.includes(` ${norm(c)} `)));
}

/** What to send back to the writer when locks went missing. */
export const missingText = (missing: EditLock[]) =>
  `These LOCKS of the original are missing from your prompt. Put each one back (with its key words), keep everything else, and return the complete JSON again:\n${missing.map((l) => `- [${l.kind}] ${l.keep} (key words: ${l.check.map((c) => `"${c}"`).join(", ")})`).join("\n")}`;

/** One line in Arabic for سجاد's chat: what the edit kept. */
export const locksForSajjad = (locks: EditLock[]) => {
  const ar: Record<LockKind, string> = { style: "الستايل", character: "الشخصيات", wardrobe: "الملابس", place: "المكان", camera: "الكاميرا", lighting: "الإضاءة", dialogue: "الحوار", sound: "الصوت", timing: "ترتيب الأحداث", other: "قواعد أخرى" };
  return [...new Set(locks.map((l) => ar[l.kind]))].join("، ");
};
