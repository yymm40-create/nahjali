// JAWAD AI — reference names and «@» mentions in the prompt. Shared by the browser (list, highlights) and the server
// (checks, what the model receives), so both apply the same rules.
//
// Every reference has a name: image1, image2, video1, audio1… (by type, in the order added), which the user may
// rename. In the prompt, «@name» points to that reference. Models number references by type in the order they are
// sent (Seedance: @image1 · @video1 · @audio1), so before sending, each «@name» is written the way the model
// understands it. The user's own prompt is kept as written.

import type { RefKind } from "@config/jawad/types";

/** A reference name: letters (any language), digits, _ and -, up to 24 characters. */
export const REF_NAME_MAX = 24;
const NAME_CHARS = "\\p{L}\\p{N}_\\-";
const NAME_RE = new RegExp(`^[${NAME_CHARS}]{1,${REF_NAME_MAX}}$`, "u");
/** «@name» not glued to a word before it (so e-mail addresses are not mentions). */
const MENTION_RE = new RegExp(`(?<![${NAME_CHARS}@])@([${NAME_CHARS}]+)`, "gu");
/** Names that can only mean a reference (a mention of one that is missing is surely a mistake). */
const DEFAULT_NAME_RE = /^(image|video|audio)\d+$/i;

export const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** A cleaned name, or null when it isn't a valid one. */
export function cleanRefName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const n = raw.trim().replace(/^@+/, "").replace(/\s+/g, "_");
  return NAME_RE.test(n) ? n : null;
}

/** The next free default name of a type: image1, image2… (a deleted name may be reused). */
export function defaultRefName(kind: RefKind, taken: readonly string[]) {
  for (let i = 1; ; i++) {
    const n = `${kind}${i}`;
    if (!taken.some((t) => sameName(t, n))) return n;
  }
}

export interface Mention {
  /** Where «@name» starts and ends in the text. */
  start: number;
  end: number;
  name: string;
}

export function findMentions(text: string): Mention[] {
  return [...text.matchAll(MENTION_RE)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, name: m[1] }));
}

/** «@name» that looks like a reference (image3…) but no added reference has that name. */
export const looksLikeRef = (name: string) => DEFAULT_NAME_RE.test(name);

/**
 * The prompt as the model should read it: each «@name» of an added reference becomes the model's own label for it
 * (its type and position among the references of that type, in the order they are sent).
 * Mentions of names that aren't references are left untouched and listed in `unknown`.
 */
export function promptForModel(prompt: string, refs: readonly { name?: string | null; kind: RefKind }[], label: (kind: RefKind, n: number) => string) {
  const counts: Record<RefKind, number> = { image: 0, video: 0, audio: 0 };
  const byName = new Map<string, string>();
  for (const r of refs) {
    counts[r.kind] += 1;
    if (r.name) byName.set(r.name.toLocaleLowerCase(), label(r.kind, counts[r.kind]));
  }
  const unknown: string[] = [];
  const text = prompt.replace(MENTION_RE, (all, name: string) => {
    const to = byName.get(name.toLocaleLowerCase());
    if (to) return to;
    unknown.push(name);
    return all;
  });
  return { text, unknown };
}

/** Renames «@old» to «@new» in a prompt (whole names only). */
export function renameMentions(prompt: string, from: string, to: string) {
  return prompt.replace(MENTION_RE, (all, name: string) => (sameName(name, from) ? `@${to}` : all));
}
