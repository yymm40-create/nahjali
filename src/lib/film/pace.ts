// «سرعة الحوار»: the words of a shot against its seconds. Seedance fits every word it is given into the shot, so too
// many words for too few seconds come out rushed. About 2 words a second reads naturally (the director writes ~25–30
// words per 15 s); the shot needs at least words ÷ 2 + 1 seconds (a second of air). Pure.

/** Words a second above which the speech comes out rushed. */
export const FAST_WORDS_PER_SEC = 2.5;

export const countWords = (text: string) => text.replace(/[ـً-ٰٟ]/g, "").split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** The seconds a shot needs for this many words. */
export const secondsFor = (words: number) => Math.ceil(words / 2 + 1);

export interface Pace {
  words: number;
  seconds: number;
  need: number;
  fast: boolean;
}

export function dialoguePace(lines: string[], seconds: number): Pace {
  const words = lines.reduce((n, l) => n + countWords(l), 0);
  return { words, seconds, need: secondsFor(words), fast: words > 0 && words / Math.max(1, seconds) > FAST_WORDS_PER_SEC };
}

const AR = (n: number) => n.toLocaleString("ar-EG");

/** «⚠️ ٢٢ كلمة في ٦ ثواني، بيسرّع — طوّلها لـ١٢ ثانية أو قسّمها» (maxSeconds: the model's longest shot). */
export function paceWarning(p: Pace, maxSeconds: number) {
  if (!p.fast) return "";
  const fix = p.need <= maxSeconds ? `طوّلها لـ${AR(p.need)} ثانية أو قسّمها` : `أطول من ${AR(maxSeconds)} ثانية — قسّمها على مقطعين أو اختصر الكلام`;
  return `⚠️ ${AR(p.words)} كلمة في ${AR(p.seconds)} ثواني، بيسرّع الكلام — ${fix}`;
}
