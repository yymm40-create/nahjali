// «الجواد الذكي!» | JAWAD AI — «النطق الدقيق» before Eleven v4 speaks Arabic. Server only.
//
//   Claude reads the text (numbered words) and gives the full vowels of the words whose sound depends on them —
//   the person's own marks kept as written, a feminine or masculine «you» followed through the whole text, words
//   read differently with other vowels (passive, homographs) — and config/jawad/diction.ts writes them for ElevenLabs.
//   Any Claude failure is the job's failure (refunded): a text sent half-checked would be charged as checked.
//   Many lines at once (a film's «ولّد كل الجمل»): ONE call reads them all with the same rules (prepareSpeechBatch),
//   instead of paying the instructions and the call once per line; a line its answer got wrong is checked alone.

import { callClaudeJson, claudeCost } from "@/lib/film/anthropic";
import { applyDiction, arabicWords, DICTION_MAX_FIXES, hasMarks, mostlyArabic, sparselyMarked, type Diction, type DictionFix, type DictionSuggestion, type WordAt } from "@config/jawad/diction";

const RULES = `You prepare Arabic text for a text-to-speech voice (ElevenLabs Eleven v4). The voice reads unvowelled Arabic by guessing, and it ignores short-vowel marks (harakat): it says «أنتِ» as «أنتَ», reads a feminine «ـكِ» as masculine, a passive verb as active. You find the words it would say wrongly and give their full vowels; the app then writes those words phonetically so the voice says them right.

You receive the whole text, then its Arabic words numbered. Return only the words that need it:
1. Words the author marked with harakat. When the author marked only some words, each marked word is deliberate: include every one. When most of the text is vowelled (a book, a supplication, a script), include only the marked words whose reading a voice could miss (rules 2 and 3, a less common reading). Either way the author's marks are the author's decision: keep each one exactly (never change, move or drop a mark the author wrote) and add the rest of the word's vowels.
2. Words whose gender, person or number lives in a short vowel: «you» forms (أنتَ/أنتِ، لكَ/لكِ، عليكَ/عليكِ، حالُكَ/حالُكِ، قلتَ/قلتِ/قلتُ، كنتَ/كنتِ/كنتُ، imperatives). Decide from the author's marks first, then from the context (who is addressed: names, adjectives such as جميلة/جميل, verbs, the speaker's note). Be consistent: once the author marks the person addressed as feminine (or masculine), every word addressing that same person follows, even unmarked ones.
3. Words that a reader without vowels would most likely say differently from what the context means: passive vs active (كُتِبَ/كَتَبَ), homographs (عِلْم/عَلَم، مَلِك/مُلْك/مَلَك، حُبّ/حَبّ), uncommon names.
Do not include words the voice already says right (common words with one usual reading). Keep the list short.

How to vowel a word:
- Mark every letter: fatha/damma/kasra, sukun on a consonant without a vowel, shadda (with its vowel) on a doubled one, tanween where it is said. A long vowel letter (ا و ي ى) after its matching vowel takes no mark; the «ل» of «ال» before a sun letter takes no mark and the sun letter takes shadda.
- Say it the way this text is meant to be read: Modern Standard Arabic with case endings inside a sentence; at a pause (before . ، ؟ ! : or the end) the last letter takes sukun — except a vowel that carries meaning, which stays even at a pause: the «you» endings (أنتِ، لكِ، قلتِ، قلتُ). If the text is colloquial (Gulf or another dialect), vowel it as it is said in that dialect, without case endings.
- The letters must stay exactly the same: same letters, same hamza forms, same order. Only marks are added.
- fem: true only when the word's last vowel is the feminine «you» kasra (أنتِ، لكِ، حالكِ، عليكِ، قلتِ، رأيتُكِ); otherwise false.`;

const SYSTEM = `${RULES}

Return {"fixes":[{"i":<word number>,"vocalized":"<the word with full vowels>","fem":<true|false>}]} in the order of the text, at most ${DICTION_MAX_FIXES}.`;

/** The same rules for many lines in one reply: each line is its own text with its own word numbers. */
const BATCH_SYSTEM = `${RULES}

SEVERAL LINES AT ONCE: you receive the lines of one piece (a film's dialogue), each as LINE <id> with its own text, its own note on the author's marks, and its own numbered words — the numbers start again at 1 in every line. Apply everything above to each line as its own text, reading the lines together for the context (who speaks to whom; the same person addressed keeps the same gender across lines). Number each line's fixes by that line's own words only.

Return {"lines":[{"id":"<the line's id, exactly>","fixes":[{"i":<word number in that line>,"vocalized":"<the word with full vowels>","fem":<true|false>}]}]}: every line once, in the order given (a line that needs nothing has "fixes":[]), each line's fixes in its order, at most ${DICTION_MAX_FIXES} per line.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixes"],
  properties: {
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["i", "vocalized", "fem"],
        properties: { i: { type: "integer" }, vocalized: { type: "string" }, fem: { type: "boolean" } },
      },
    },
  },
};

const FIX_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["i", "vocalized", "fem"],
  properties: { i: { type: "integer" }, vocalized: { type: "string" }, fem: { type: "boolean" } },
};

const BATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lines"],
  properties: {
    lines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "fixes"],
        properties: { id: { type: "string" }, fixes: { type: "array", items: FIX_SCHEMA } },
      },
    },
  },
};

export interface PreparedSpeech {
  /** What ElevenLabs receives. */
  text: string;
  /** language_code for an Arabic text («ar»: the model and its number reading in Arabic). */
  languageCode?: string;
  fixes: DictionFix[];
  /** What the check cost (Claude), USD. */
  usd: number;
}

/**
 * The text as Eleven v4 should get it. A text with no Arabic, or the mode «كما كتبت», goes as written (Arabic still
 * names its language). `note` tells Claude who speaks to whom when the text alone may not (a film's line).
 */
export async function prepareSpeech(text: string, mode: Diction, note = ""): Promise<PreparedSpeech> {
  const languageCode = mostlyArabic(text) ? "ar" : undefined;
  const words = arabicWords(text);
  if (mode === "off" || !words.length) return { text, languageCode, fixes: [], usd: 0 };
  const numbered = numberedWords(words);
  const marks = marksNote(words);
  const r = await callClaudeJson<{ fixes: DictionSuggestion[] }>({
    system: SYSTEM,
    turns: [{ role: "user", content: `${note ? `Note: ${note}\n\n` : ""}TEXT:\n<<<\n${text}\n>>>\n\n${marks}\n\nWORDS:\n${numbered}` }],
    schema: SCHEMA,
    // (each fix is about 30 tokens; room for the thinking before them)
    maxTokens: Math.min(32_000, 6_000 + words.length * 40),
    effort: "medium",
  });
  const out = applyDiction(text, Array.isArray(r.data.fixes) ? r.data.fixes : [], mode);
  return { text: out.text, languageCode, fixes: out.fixes, usd: claudeCost(r.usage) };
}

const numberedWords = (words: WordAt[]) => words.map((w) => `${w.i}:${w.word}`).join(" ");
const marksNote = (words: WordAt[]) => {
  const marked = words.filter((w) => hasMarks(w.word)).length;
  return `The author marked ${marked} of ${words.length} words with vowels: ${sparselyMarked(words) ? "only some, so each marked word is deliberate." : "most of the text is vowelled, so pick only the words a voice could say wrong."}`;
};

/** One line of many. `note`: what prepareSpeech would be told about it alone; `label`: its short heading in a batch. */
export interface SpeechLine {
  id: string;
  text: string;
  /** e.g. who says it, when the line is checked alone (the single call, and the fallback) */
  note?: string;
  /** e.g. «said by «X», in GEN-01»: its heading among the other lines */
  label?: string;
}

/** Words read in one call at most (the reply stays well inside its token budget); a longer set is split. */
export const DICTION_BATCH_WORDS = 600;
/** Lines in one call at most. */
export const DICTION_BATCH_LINES = 60;

interface Pending {
  line: SpeechLine;
  words: WordAt[];
  languageCode?: string;
}

/** Pieces of at most DICTION_BATCH_WORDS words and DICTION_BATCH_LINES lines, in order. Pure. */
export function batchesOf<T extends { words: unknown[] }>(list: T[], maxWords = DICTION_BATCH_WORDS, maxLines = DICTION_BATCH_LINES): T[][] {
  const out: T[][] = [];
  let cur: T[] = [];
  let n = 0;
  for (const x of list) {
    if (cur.length && (n + x.words.length > maxWords || cur.length >= maxLines)) {
      out.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(x);
    n += x.words.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

/**
 * A line's part of a batch reply, or null when it is missing or does not fit the line (not a list, a word number the
 * line does not have): that line is then checked alone. Pure.
 */
export function lineFixes(reply: unknown, id: string, wordCount: number): DictionSuggestion[] | null {
  const lines = (reply as { lines?: unknown } | null)?.lines;
  if (!Array.isArray(lines)) return null;
  const entry = lines.find((l) => l && typeof l === "object" && (l as { id?: unknown }).id === id) as { fixes?: unknown } | undefined;
  if (!entry || !Array.isArray(entry.fixes)) return null;
  const ok = entry.fixes.every((f) => f && typeof f === "object" && Number.isInteger((f as DictionSuggestion).i) && (f as DictionSuggestion).i >= 1 && (f as DictionSuggestion).i <= wordCount && typeof (f as DictionSuggestion).vocalized === "string");
  return ok ? (entry.fixes as DictionSuggestion[]) : null;
}

/**
 * «النطق الدقيق» for many lines: the lines that need Claude are read in ONE call (per DICTION_BATCH_WORDS words), with
 * the same rules as prepareSpeech and the same result for each line (its text, its word fixes by its own word numbers).
 * A single line goes the single way; a line the batch answered wrongly is checked alone (only that line). `context` is
 * said once for all (e.g. the scenes' lines). Each line's `usd` is its share of the call (by its words) plus its own
 * call when it needed one. A failed batch call throws (nothing was prepared).
 */
export async function prepareSpeechBatch(lines: SpeechLine[], mode: Diction, context = ""): Promise<Map<string, PreparedSpeech>> {
  const out = new Map<string, PreparedSpeech>();
  const todo: Pending[] = [];
  for (const line of lines) {
    if (out.has(line.id) || todo.some((t) => t.line.id === line.id)) continue;
    const languageCode = mostlyArabic(line.text) ? "ar" : undefined;
    const words = arabicWords(line.text);
    if (mode === "off" || !words.length) out.set(line.id, { text: line.text, languageCode, fixes: [], usd: 0 });
    else todo.push({ line, words, languageCode });
  }
  const alone = (p: Pending) => prepareSpeech(p.line.text, mode, p.line.note ?? "");
  const results = await Promise.all(
    batchesOf(todo).map(async (batch): Promise<[string, PreparedSpeech][]> => {
      if (batch.length === 1) return [[batch[0].line.id, await alone(batch[0])]];
      const total = batch.reduce((n, p) => n + p.words.length, 0);
      const body = batch.map((p) => `LINE ${p.line.id}${p.line.label ? ` (${p.line.label})` : ""}\nTEXT:\n<<<\n${p.line.text}\n>>>\n${marksNote(p.words)}\nWORDS:\n${numberedWords(p.words)}`).join("\n\n");
      const r = await callClaudeJson<{ lines: { id: string; fixes: DictionSuggestion[] }[] }>({
        system: BATCH_SYSTEM,
        turns: [{ role: "user", content: `${context ? `Note: ${context}\n\n` : ""}${batch.length} LINES:\n\n${body}` }],
        schema: BATCH_SCHEMA,
        // (the same room per word as one line, and a little per line for its id)
        maxTokens: Math.min(32_000, 6_000 + total * 40 + batch.length * 20),
        effort: "medium",
      });
      const usd = claudeCost(r.usage);
      return Promise.all(
        batch.map(async (p): Promise<[string, PreparedSpeech]> => {
          const share = (usd * p.words.length) / total;
          const fixes = lineFixes(r.data, p.line.id, p.words.length);
          if (!fixes) {
            const own = await alone(p);
            return [p.line.id, { ...own, usd: own.usd + share }];
          }
          const done = applyDiction(p.line.text, fixes, mode as Exclude<Diction, "off">);
          return [p.line.id, { text: done.text, languageCode: p.languageCode, fixes: done.fixes, usd: share }];
        }),
      );
    }),
  );
  for (const list of results) for (const [id, prepared] of list) out.set(id, prepared);
  return out;
}
