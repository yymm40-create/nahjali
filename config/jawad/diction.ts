// «الجواد الذكي!» | JAWAD AI — «النطق الدقيق»: Arabic short vowels that ElevenLabs would otherwise guess (أنتِ read as
// أنتَ, a feminine «ـكِ» read masculine, a passive read active). Shared by the studio and the server. Pure.
//
//   Claude marks every vowel of the words whose sound depends on them (keeping each mark the person wrote), and
//   those words are sent either
//     precise ─► in IPA between slashes: Eleven v4 reads «/.../» as a pronunciation, in any language it speaks
//                (elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices — «IPA with Eleven v4»)
//     spelled ─► with the vowel written as a letter where it decides the meaning (أنتِ → أنتي), for a voice that
//                reads IPA oddly
//     off     ─► as written.

export type Diction = "precise" | "spelled" | "off";
export const DICTION_KEY = "diction";
export const DICTION_VALUES: { value: Diction; label: string; hint: string }[] = [
  { value: "precise", label: "دقيق", hint: "نطق صوتي (IPA)" },
  { value: "spelled", label: "كتابة صوتية", hint: "أنتِ ← أنتي" },
  { value: "off", label: "كما كتبت", hint: "بدون تدقيق" },
];
/** Words corrected in one request at most (a long text keeps the ones that matter most, in order). */
export const DICTION_MAX_FIXES = 400;

const FATHA = "َ";
const DAMMA = "ُ";
const KASRA = "ِ";
const SHADDA = "ّ";
const SUKUN = "ْ";
const FATHATAN = "ً";
const DAMMATAN = "ٌ";
const KASRATAN = "ٍ";
const DAGGER = "ٰ";
const TATWEEL = "ـ";
const MARKS = new Set([FATHA, DAMMA, KASRA, SHADDA, SUKUN, FATHATAN, DAMMATAN, KASRATAN, DAGGER]);
const VOWEL_OF: Record<string, string> = { [FATHA]: "a", [DAMMA]: "u", [KASRA]: "i" };
const TANWEEN_OF: Record<string, string> = { [FATHATAN]: "a", [DAMMATAN]: "u", [KASRATAN]: "i" };

/** An Arabic word: letters (Persian/Urdu forms too) with their marks. */
export const ARABIC_WORD = /[ء-غـ-ٕٮ-ۓ]+/g;
const ARABIC_LETTER = /[ء-غف-يٮ-ۓ]/g;
const LATIN_LETTER = /[A-Za-z]/g;

export const hasMarks = (s: string) => /[ً-ْٰ]/.test(s);
export const stripMarks = (s: string) => s.normalize("NFC").replace(/[ً-ْٰـ]/g, "");

/** Mostly Arabic (letters, not counting [tags]): the request then names the language (language_code «ar»). */
export function mostlyArabic(text: string) {
  const plain = text.replace(/\[[^\]]*\]/g, "");
  const ar = plain.match(ARABIC_LETTER)?.length ?? 0;
  const la = plain.match(LATIN_LETTER)?.length ?? 0;
  return ar > 0 && ar >= la;
}

/**
 * Whether the writer marked only some words (each mark then deliberate: sent as marked) rather than vowelling the
 * whole text (a book, a supplication, the film director's lines), where only the words a voice could miss matter.
 */
export const sparselyMarked = (words: { word: string }[]) => words.filter((w) => hasMarks(w.word)).length <= words.length / 2;

export interface WordAt {
  i: number;
  word: string;
  start: number;
  end: number;
}

/** The Arabic words of a text, numbered from 1, with where each one is (NFC). */
export function arabicWords(text: string): WordAt[] {
  const t = text.normalize("NFC");
  return [...t.matchAll(ARABIC_WORD)].filter((m) => stripMarks(m[0]).length > 0).map((m, k) => ({ i: k + 1, word: m[0], start: m.index!, end: m.index! + m[0].length }));
}

interface Unit {
  ch: string;
  marks: Set<string>;
}

function units(word: string): Unit[] {
  const out: Unit[] = [];
  for (const ch of word.normalize("NFC")) {
    if (ch === TATWEEL) continue;
    if (MARKS.has(ch)) {
      out.at(-1)?.marks.add(ch);
      continue;
    }
    // (hamza and madda written as separate marks are folded into their letters by NFC; any left over are dropped)
    if (ch >= "ٓ" && ch <= "ٕ") continue;
    out.push({ ch, marks: new Set() });
  }
  return out;
}

const vowelMark = (u: Unit) => [FATHA, DAMMA, KASRA].find((m) => u.marks.has(m));
const tanweenMark = (u: Unit) => [FATHATAN, DAMMATAN, KASRATAN].find((m) => u.marks.has(m));

/**
 * A suggested vocalization is used only if it is the same word (the same letters) and keeps every mark the person
 * put (it may add marks, never change one).
 */
export function keepsWord(original: string, vocalized: string) {
  if (stripMarks(original) !== stripMarks(vocalized)) return false;
  const a = units(original);
  const b = units(vocalized);
  if (a.length !== b.length) return false;
  return a.every((u, k) => {
    for (const m of u.marks) if (!b[k].marks.has(m)) return false;
    const vb = [FATHA, DAMMA, KASRA, FATHATAN, DAMMATAN, KASRATAN].filter((m) => b[k].marks.has(m));
    return vb.length <= 1;
  });
}

/** Every letter that needs a vowel has one (long-vowel letters and a silent alif need none). */
export function fullyMarked(word: string) {
  const us = units(word);
  return us.length > 0 && us.every((u, k) => u.marks.size > 0 || "اىآ".includes(u.ch) || ((u.ch === "و" || u.ch === "ي") && k > 0) || (u.ch === "ل" && us[k + 1]?.marks.has(SHADDA)) || (u.ch === "ة" && k === us.length - 1));
}

// ───────────────────────────── IPA ─────────────────────────────

const CONSONANT: Record<string, string> = {
  ب: "b", ت: "t", ث: "θ", ج: "dʒ", ح: "ħ", خ: "x", د: "d", ذ: "ð", ر: "r", ز: "z", س: "s", ش: "ʃ", ص: "sˤ", ض: "dˤ", ط: "tˤ", ظ: "ðˤ",
  ع: "ʕ", غ: "ɣ", ف: "f", ق: "q", ك: "k", ک: "k", ل: "l", م: "m", ن: "n", ه: "h", ء: "ʔ", أ: "ʔ", إ: "ʔ", ؤ: "ʔ", ئ: "ʔ", چ: "tʃ", گ: "g",
  ڤ: "v", پ: "p", و: "w", ي: "j", ی: "j", ة: "t",
};

/** One-letter words written joined to the next: وَ فَ بِ كَ لِ (and the «ل» of «لِل»). */
const PREFIX = "وفبكل";

type Seg = { c: string } | { v: string };
const isV = (s: Seg | undefined): s is { v: string } => Boolean(s && "v" in s);

/**
 * IPA of a fully vowelled word (Modern Standard pronunciation, stress marked), or null for anything it cannot read.
 * Consonant doubling (shadda) is written twice; long vowels with «ː».
 */
export function toIpa(word: string): string | null {
  const us = units(word);
  if (!us.length) return null;
  const segs: Seg[] = [];
  const last = () => segs.at(-1);
  const lengthen = (v: string) => {
    const l = last();
    if (isV(l) && l.v === v) l.v = `${v}ː`;
    else segs.push({ v: `${v}ː` });
  };
  for (let k = 0; k < us.length; k++) {
    const u = us[k];
    const vm = vowelMark(u);
    const tn = tanweenMark(u);
    const end = k === us.length - 1;
    const prev = us[k - 1];
    const vowelAfter = () => {
      if (vm) segs.push({ v: VOWEL_OF[vm] });
      else if (tn) segs.push({ v: TANWEEN_OF[tn] }, { c: "n" });
      if (u.marks.has(DAGGER)) lengthen("a");
    };
    switch (u.ch) {
      case "ا":
      case "ٱ":
        if (k === 0) {
          // A connecting alif at the start: its vowel only (a mark if there is one, else «a» as in «ال»)
          segs.push({ v: vm ? VOWEL_OF[vm] : "a" });
        } else if (u.ch === "ٱ" || (!vm && us[k + 1]?.ch === "ل" && us.slice(0, k).every((p) => PREFIX.includes(p.ch)))) {
          // silent: the «ا» of «ال» after وَ فَ بِ كَ لِ (وَالكتاب → wal-kitaːb)
        } else if (prev && (prev.marks.has(FATHATAN) || (end && prev.ch === "و" && !vowelMark(prev)))) {
          // silent: شكرًا, كتبوا
        } else lengthen("a");
        continue;
      case "ى":
        if (vm === KASRA) {
          segs.push({ c: "j" }, { v: "i" });
          continue;
        }
        if (!(prev && prev.marks.has(FATHATAN))) lengthen("a");
        continue;
      case "آ":
        segs.push({ c: "ʔ" }, { v: "aː" });
        continue;
      case "و":
      case "ي":
      case "ی": {
        const long = u.ch === "و" ? "u" : "i";
        const glide = u.ch === "و" ? "w" : "j";
        if (vm || tn || u.marks.has(SHADDA) || k === 0) break;
        const l = last();
        if (isV(l) && l.v === long) l.v = `${long}ː`;
        else if (isV(l) && l.v === "a") segs.push({ c: glide });
        else if (!isV(l)) segs.push({ v: `${long}ː` });
        else segs.push({ c: glide });
        continue;
      }
      case "ة":
        if (!vm && !tn) {
          if (!isV(last())) segs.push({ v: "a" });
          continue;
        }
        break;
      case "ل":
        // The «l» of «ال» before a doubled (sun) letter is not said: الشَّمس → aʃʃams
        if (!vm && !tn && !u.marks.has(SHADDA) && !u.marks.has(SUKUN) && us[k + 1]?.marks.has(SHADDA) && us.slice(0, k).every((p) => p.ch === "ا" || p.ch === "ٱ" || PREFIX.includes(p.ch))) continue;
        break;
      case "إ":
        segs.push({ c: "ʔ" }, { v: vm ? VOWEL_OF[vm] : "i" });
        if (tn) segs.push({ c: "n" });
        continue;
    }
    const c = CONSONANT[u.ch];
    if (!c) return null;
    segs.push({ c });
    if (u.marks.has(SHADDA)) segs.push({ c });
    vowelAfter();
  }
  return stressed(segs);
}

/** Classical Arabic stress: a superheavy last syllable, else a heavy second-to-last, else the third-to-last. */
function stressed(segs: Seg[]) {
  const nuclei = segs.flatMap((s, k) => (isV(s) ? [k] : []));
  if (!nuclei.length) return null;
  // Each syllable starts at the consonant right before its vowel (or at the vowel, at the very start)
  const starts = nuclei.map((n, j) => (n > 0 && !isV(segs[n - 1]) && (j === 0 || n - 1 > nuclei[j - 1]) ? n - 1 : n));
  starts[0] = 0;
  const weight = (j: number) => {
    const n = nuclei[j];
    const stop = j + 1 < starts.length ? starts[j + 1] : segs.length;
    const long = (segs[n] as { v: string }).v.endsWith("ː");
    const coda = stop - n - 1;
    return (long ? 2 : 1) + coda;
  };
  const N = nuclei.length;
  let at = N - 1;
  if (N > 1) {
    if (weight(N - 1) >= 3) at = N - 1;
    else if (weight(N - 2) >= 2 || N === 2) at = N - 2;
    else at = N - 3;
  }
  const text = (from: number, to: number) => segs.slice(from, to).map((s) => ("v" in s ? s.v : s.c)).join("");
  return N > 1 ? `${text(0, starts[at])}ˈ${text(starts[at], segs.length)}` : text(0, segs.length);
}

// ───────────────────────────── writing the vowel as a letter ─────────────────────────────

/**
 * A word ending in the feminine «you» kasra (أنتِ، لكِ، حالكِ، قلتِ) with that vowel written as a letter, the way
 * people write it when they want it heard: «ي». (Only for words Claude marked as such: «بيتِ» is not «بيتي».)
 */
export function spelledOut(vocalized: string) {
  const us = units(vocalized);
  const end = us.at(-1);
  if (!end || !end.marks.has(KASRA) || !CONSONANT[end.ch] || "وي".includes(end.ch)) return vocalized.normalize("NFC");
  return `${vocalized.normalize("NFC").replace(/ِ([ّ]?)$/u, "$1")}ي`;
}

// ───────────────────────────── the text sent ─────────────────────────────

export interface DictionFix {
  i: number;
  word: string;
  vocalized: string;
  sent: string;
}

/** Claude's answer for one word: its full vowels, and whether its last vowel is the feminine «you» kasra. */
export interface DictionSuggestion {
  i: number;
  vocalized: string;
  fem?: boolean;
}

/**
 * The text with each kept fix written the chosen way (precise: «/ipa/»; spelled: the feminine ending as a letter,
 * other words with their vowel marks); words without a usable suggestion stay as written.
 */
export function applyDiction(text: string, suggestions: DictionSuggestion[], mode: Exclude<Diction, "off">) {
  const t = text.normalize("NFC");
  const words = arabicWords(t);
  const byIndex = new Map(words.map((w) => [w.i, w]));
  const fixes: DictionFix[] = [];
  const seen = new Set<number>();
  for (const s of suggestions) {
    const w = byIndex.get(s.i);
    if (!w || seen.has(s.i) || fixes.length >= DICTION_MAX_FIXES) continue;
    const vocalized = String(s.vocalized ?? "").normalize("NFC").trim();
    if (!keepsWord(w.word, vocalized)) continue;
    const sent = mode === "precise" ? ipaOrNull(vocalized) : s.fem ? spelledOut(vocalized) : vocalized;
    if (!sent || sent === w.word) continue;
    seen.add(s.i);
    fixes.push({ i: s.i, word: w.word, vocalized, sent });
  }
  // The writer's own fully vowelled words (in a text where only some are marked) are said their way even when no
  // suggestion came for them
  const deliberate = sparselyMarked(words);
  for (const w of words) {
    if (mode !== "precise" || !deliberate || seen.has(w.i) || !hasMarks(w.word) || !fullyMarked(w.word) || fixes.length >= DICTION_MAX_FIXES) continue;
    const sent = ipaOrNull(w.word);
    if (sent) fixes.push({ i: w.i, word: w.word, vocalized: w.word, sent });
  }
  fixes.sort((a, b) => a.i - b.i);
  let out = "";
  let at = 0;
  for (const f of fixes) {
    const w = byIndex.get(f.i)!;
    out += t.slice(at, w.start) + f.sent;
    at = w.end;
  }
  return { text: out + t.slice(at), fixes };
}

const ipaOrNull = (w: string) => {
  const ipa = toIpa(w);
  return ipa ? `/${ipa}/` : null;
};
