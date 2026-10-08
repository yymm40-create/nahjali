// JAWAD AI · «المخرج الخارق» — the website's rules for the prompt it writes (shared: the server checks every answer,
// the tests check the rules). The skill itself is the approved one in config/film-prompts/director.ts.

import { findMentions, looksLikeRef, sameName } from "./mentions";

/** Characters allowed in each language, not counting the spoken lines (owner's rule). */
export const DIRECTOR_LIMITS = { en: 1000, zh: 500 } as const;

const ARABIC = /\p{Script=Arabic}/u;
/** Spoken lines are written inside double quotes ("…", “…”, 「…」); they don't count toward the limits. */
const SPOKEN = /"[^"\n]*"|“[^”\n]*”|「[^」\n]*」/gu;
const SKILL_LABEL = /<<<\s*(image|video|audio)_\d+\s*>>>/i;

/** Length without the spoken lines, in characters (code points). */
export const unspokenLength = (text: string) => [...text.replace(SPOKEN, "")].length;

export interface DirectorOutput {
  en: string;
  zh: string;
}

/** What breaks the website's rules in an answer (empty = fine). Each message is written for the model to fix. */
export function directorProblems(out: DirectorOutput, names: readonly string[]): string[] {
  const p: string[] = [];
  const en = typeof out.en === "string" ? out.en.trim() : "";
  const zh = typeof out.zh === "string" ? out.zh.trim() : "";
  if (!en || !zh) p.push("Both \"en\" and \"zh\" must contain the complete prompt.");
  if (ARABIC.test(en + zh)) p.push("Arabic script found. Write every spoken Arabic line in Latin letters (a faithful transliteration of the same words) and remove all Arabic script.");
  const enLen = unspokenLength(en);
  if (enLen > DIRECTOR_LIMITS.en) p.push(`"en" has ${enLen} characters without the quoted spoken lines; the maximum is ${DIRECTOR_LIMITS.en}. Shorten it (trim in the skill's order).`);
  const zhLen = unspokenLength(zh);
  if (zhLen > DIRECTOR_LIMITS.zh) p.push(`"zh" has ${zhLen} characters without the quoted spoken lines; the maximum is ${DIRECTOR_LIMITS.zh}. Shorten it (trim in the skill's order).`);
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
