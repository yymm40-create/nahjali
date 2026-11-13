// A small change answered as a PATCH: exact search/replace edits on the text Claude was shown, instead of the whole text
// written again (a reply's output is the dear part of a call: a whole scene program or game page is 10–40k tokens, a
// colour change a few hundred). Shared by «مختبر الموشن» (a note on the scene program) and «صانع الألعاب» (a change to a
// game's page). Each edit's old text must occur EXACTLY ONCE in the text as it stands when its turn comes (the edits
// apply in order, each on the result of the one before); anything else fails the whole patch, and the caller asks for
// the whole text instead. Pure.

export interface TextEdit {
  old: string;
  new: string;
}

export type Patched = { ok: true; text: string } | { ok: false; why: string };

/** The edits applied in order; the first one that is empty, missing or found more than once fails the whole patch. */
export function applyEdits(text: string, edits: readonly TextEdit[]): Patched {
  if (!edits.length) return { ok: false, why: "the patch has no edits" };
  let out = text;
  for (let i = 0; i < edits.length; i++) {
    const e = edits[i];
    const fail = (why: string): Patched => ({ ok: false, why: `edit ${i + 1} of ${edits.length}: ${why}` });
    if (!e.old) return fail("its old text is empty");
    const at = out.indexOf(e.old);
    if (at < 0) return fail(`its old text is not in the text: «${e.old.slice(0, 120)}»`);
    // a second match (overlapping too) makes it ambiguous: which one was meant cannot be known
    if (out.indexOf(e.old, at + 1) >= 0) return fail(`its old text occurs more than once (give more of the lines around it): «${e.old.slice(0, 120)}»`);
    out = out.slice(0, at) + e.new + out.slice(at + e.old.length);
  }
  return { ok: true, text: out };
}

/** Edits from a JSON answer ([{ old, new }]): strings only, at most `max`; anything else is dropped. */
export function readEdits(raw: unknown, max = 80): TextEdit[] {
  return (Array.isArray(raw) ? raw : [])
    .map((x) => (x ?? {}) as Record<string, unknown>)
    .filter((x) => typeof x.old === "string" && typeof x.new === "string")
    .map((x) => ({ old: x.old as string, new: x.new as string }))
    .slice(0, max);
}

const SEARCH = "<<<<<<< SEARCH";
const SPLIT = "=======";
const REPLACE = ">>>>>>> REPLACE";

/** How a plain-text answer writes its edits (the format readSearchReplace reads), for a prompt. */
export const SEARCH_REPLACE_FORMAT = `${SEARCH}
the exact lines to find (copied character for character, enough of them to occur only once)
${SPLIT}
the lines that replace them
${REPLACE}`;

/**
 * Edits from a plain-text answer of SEARCH/REPLACE blocks (SEARCH_REPLACE_FORMAT; text around the blocks is ignored).
 * Null when there is no block or a block is broken (a marker missing, an answer cut off in the middle).
 */
export function readSearchReplace(answer: string): TextEdit[] | null {
  const s = answer.replace(/\r\n/g, "\n");
  const re = /^<<<<<<< SEARCH[ \t]*\n([\s\S]*?)^=======[ \t]*\n([\s\S]*?)^>>>>>>> REPLACE[ \t]*$/gm;
  const edits: TextEdit[] = [];
  for (const m of s.matchAll(re)) {
    // a block missing its own markers would swallow the next one: the patch is broken
    if (m[1].includes(SEARCH) || m[2].includes(SEARCH) || m[1].includes(REPLACE)) return null;
    edits.push({ old: m[1].replace(/\n$/, ""), new: m[2].replace(/\n$/, "") });
  }
  const opened = s.split("\n").filter((l) => l.trimEnd() === SEARCH).length;
  return edits.length && edits.length === opened ? edits : null;
}
