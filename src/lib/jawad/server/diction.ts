// «الجواد الذكي!» | JAWAD AI — «النطق الدقيق» before Eleven v4 speaks Arabic. Server only.
//
//   Claude reads the text (numbered words) and gives the full vowels of the words whose sound depends on them —
//   the person's own marks kept as written, a feminine or masculine «you» followed through the whole text, words
//   read differently with other vowels (passive, homographs) — and config/jawad/diction.ts writes them for ElevenLabs.
//   Any Claude failure is the job's failure (refunded): a text sent half-checked would be charged as checked.

import { callClaudeJson, claudeCost } from "@/lib/film/anthropic";
import { applyDiction, arabicWords, DICTION_MAX_FIXES, hasMarks, mostlyArabic, sparselyMarked, type Diction, type DictionFix, type DictionSuggestion } from "@config/jawad/diction";

const SYSTEM = `You prepare Arabic text for a text-to-speech voice (ElevenLabs Eleven v4). The voice reads unvowelled Arabic by guessing, and it ignores short-vowel marks (harakat): it says «أنتِ» as «أنتَ», reads a feminine «ـكِ» as masculine, a passive verb as active. You find the words it would say wrongly and give their full vowels; the app then writes those words phonetically so the voice says them right.

You receive the whole text, then its Arabic words numbered. Return only the words that need it:
1. Words the author marked with harakat. When the author marked only some words, each marked word is deliberate: include every one. When most of the text is vowelled (a book, a supplication, a script), include only the marked words whose reading a voice could miss (rules 2 and 3, a less common reading). Either way the author's marks are the author's decision: keep each one exactly (never change, move or drop a mark the author wrote) and add the rest of the word's vowels.
2. Words whose gender, person or number lives in a short vowel: «you» forms (أنتَ/أنتِ، لكَ/لكِ، عليكَ/عليكِ، حالُكَ/حالُكِ، قلتَ/قلتِ/قلتُ، كنتَ/كنتِ/كنتُ، imperatives). Decide from the author's marks first, then from the context (who is addressed: names, adjectives such as جميلة/جميل, verbs, the speaker's note). Be consistent: once the author marks the person addressed as feminine (or masculine), every word addressing that same person follows, even unmarked ones.
3. Words that a reader without vowels would most likely say differently from what the context means: passive vs active (كُتِبَ/كَتَبَ), homographs (عِلْم/عَلَم، مَلِك/مُلْك/مَلَك، حُبّ/حَبّ), uncommon names.
Do not include words the voice already says right (common words with one usual reading). Keep the list short.

How to vowel a word:
- Mark every letter: fatha/damma/kasra, sukun on a consonant without a vowel, shadda (with its vowel) on a doubled one, tanween where it is said. A long vowel letter (ا و ي ى) after its matching vowel takes no mark; the «ل» of «ال» before a sun letter takes no mark and the sun letter takes shadda.
- Say it the way this text is meant to be read: Modern Standard Arabic with case endings inside a sentence; at a pause (before . ، ؟ ! : or the end) the last letter takes sukun — except a vowel that carries meaning, which stays even at a pause: the «you» endings (أنتِ، لكِ، قلتِ، قلتُ). If the text is colloquial (Gulf or another dialect), vowel it as it is said in that dialect, without case endings.
- The letters must stay exactly the same: same letters, same hamza forms, same order. Only marks are added.
- fem: true only when the word's last vowel is the feminine «you» kasra (أنتِ، لكِ، حالكِ، عليكِ، قلتِ، رأيتُكِ); otherwise false.

Return {"fixes":[{"i":<word number>,"vocalized":"<the word with full vowels>","fem":<true|false>}]} in the order of the text, at most ${DICTION_MAX_FIXES}.`;

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
  const numbered = words.map((w) => `${w.i}:${w.word}`).join(" ");
  const marked = words.filter((w) => hasMarks(w.word)).length;
  const marks = `The author marked ${marked} of ${words.length} words with vowels: ${sparselyMarked(words) ? "only some, so each marked word is deliberate." : "most of the text is vowelled, so pick only the words a voice could say wrong."}`;
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
