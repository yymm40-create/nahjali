// JAWAD AI · «المخرج الخارق» — the website's rules for the prompt it writes (shared: the server checks every answer,
// the tests check the rules). The skill itself is the approved one in config/film-prompts/director.ts.

import { findMentions, looksLikeRef, sameName } from "./mentions";

// No length limit: the prompt is as long as the story needs (owner's order, 7 November 2026 — the old 1000 EN + 500 ZH
// guide cut the dialogue and the direction out of developed prompts, the film maker's director has no such limit).

const ARABIC = /\p{Script=Arabic}/u;
/** The lines the person quoted in their own prompt ("…", “…”, 「…」, «…»). */
const QUOTED = /"[^"\n]*"|“[^”\n]*”|「[^」\n]*」|«[^»\n]*»/gu;
/** Arabic diacritics and the tatweel: a line is the same line with or without them. */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
const SKILL_LABEL = /<<<\s*(image|video|audio)_\d+\s*>>>/i;

export interface DirectorOutput {
  en: string;
  zh: string;
}

/** A line without its diacritics, spaces and punctuation, so two spellings of the same words compare equal. */
const squash = (t: string) => t.replace(ARABIC_MARKS, "").replace(/[\s\p{P}]+/gu, "").toLowerCase();

/** The spoken lines the person wrote inside quotes in their prompt (each without its quotes). */
export const quotedLines = (prompt: string) => (prompt.match(QUOTED) ?? []).map((q) => q.slice(1, -1).trim()).filter(Boolean);

/**
 * The person's quoted lines that are not in the developed prompt (diacritics, spacing and punctuation aside): the
 * director must never cut the dialogue (the film maker's rule — «Do not silently shorten dialogue»).
 */
export function missingLines(original: string, out: DirectorOutput): string[] {
  const kept = squash(out.en);
  return quotedLines(original).filter((l) => !kept.includes(squash(l)));
}

/**
 * What breaks the website's rules in an answer (empty = fine). Each message is written for the model to fix.
 * `arabic`: spoken Arabic stays in Arabic script (the film maker's rule); otherwise it is transliterated in Latin
 * letters, for a generator that can't read Arabic (Seedance 2.0).
 */
export function directorProblems(out: DirectorOutput, names: readonly string[], opts: { arabic?: boolean } = {}): string[] {
  const p: string[] = [];
  const en = typeof out.en === "string" ? out.en.trim() : "";
  const zh = typeof out.zh === "string" ? out.zh.trim() : "";
  if (!en || !zh) p.push("Both \"en\" and \"zh\" must contain the complete prompt.");
  if (!opts.arabic && ARABIC.test(en + zh)) p.push("Arabic script found. Write every spoken Arabic line in Latin letters (a faithful transliteration of the same words) and remove all Arabic script.");
  if (SKILL_LABEL.test(en + zh)) p.push("Use the references' @names only, never <<<image_n>>>/<<<video_n>>>/<<<audio_n>>> labels.");
  const unknown = [...new Set(findMentions(`${en}\n${zh}`).filter((m) => looksLikeRef(m.name) && !names.some((n) => sameName(n, m.name))).map((m) => `@${m.name}`))];
  if (unknown.length) p.push(`${unknown.join(", ")} ${unknown.length > 1 ? "are" : "is"} not one of the given references. Use only these @names: ${names.length ? names.map((n) => `@${n}`).join(", ") : "(none — don't mention references)"}.`);
  return p;
}

/**
 * The last answer after the retries, repaired where a machine can do it safely, instead of failing the whole edit:
 * the skill's <<<image_n>>> labels become the references' @names (in the order they are sent), and an @name that is
 * not a reference loses its «@». What remains (a prompt over the owner's length guide, Arabic in a spoken line) is
 * accepted: the generator reads long prompts and Arabic, and a working edit beats a refusal. Only an empty prompt is
 * hopeless (null).
 */
export function salvageDirector(out: DirectorOutput, names: readonly string[]): DirectorOutput | null {
  const fix = (t: unknown) => {
    let text = typeof t === "string" ? t.trim() : "";
    text = text.replace(/<<<\s*(image|video|audio)_(\d+)\s*>>>/gi, (m, _k, n) => (names[Number(n) - 1] ? `@${names[Number(n) - 1]}` : ""));
    for (const m of findMentions(text).reverse()) {
      if (looksLikeRef(m.name) && !names.some((n) => sameName(n, m.name))) text = text.slice(0, m.start) + m.name + text.slice(m.end);
    }
    return text;
  };
  const en = fix(out.en);
  const zh = fix(out.zh);
  if (!en && !zh) return null;
  return { en: en || zh, zh: zh || en };
}

/** The prompt put in the studio's prompt box: English, then Chinese. */
export const directorPrompt = (out: DirectorOutput) => `${out.en.trim()}\n\n${out.zh.trim()}`;
