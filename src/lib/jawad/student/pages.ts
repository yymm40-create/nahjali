// «الطالب الذكي» — the page count the student asked for, kept exactly. Pure (no server imports): the writer gets a word
// budget per chapter from it, the PDF is set to land on that count (type scaled a little, never below readable), and a
// file still off by more than that is rewritten shorter or longer (outputs.ts).

/** Words of body text one page holds at the normal size (Arabic, the book's type and line spacing). */
export const PAGE_WORDS = { A4: 300, A5: 140 } as const;
export type PageSize = keyof typeof PAGE_WORDS;

/** How far the type may be scaled to land on the count: readable at the smallest, not childish at the largest. */
export const FIT_SCALE = { min: 0.84, max: 1.28 } as const;

/** Rewrites (shorter or longer) allowed when the type alone can't reach the count. */
export const MAX_REFITS = 2;

/** The pages that aren't body text: a cover from 4 pages up, a contents page from 6 pages up (more than one chapter). */
export function frontPages(pages: number, chapters: number) {
  const cover = pages >= 4;
  const toc = pages >= 6 && chapters > 1;
  return { cover, toc, count: Number(cover) + Number(toc) };
}

/** Words for the whole body and for each chapter (shared by the chapters' weights, at least 40 words each). */
export function wordBudget(pages: number, size: PageSize, weights: number[]) {
  const n = Math.max(1, weights.length);
  const front = frontPages(pages, n).count;
  const total = Math.max(40 * n, Math.round((pages - front) * PAGE_WORDS[size]));
  const sum = weights.reduce((a, b) => a + Math.max(1, b), 0) || n;
  return { total, chapters: (weights.length ? weights : [1]).map((w) => Math.max(40, Math.round((total * Math.max(1, w)) / sum))) };
}

/** Chapters a document of this many pages should have (a 1-page summary is one chapter). */
export const maxChapters = (pages: number) => Math.max(1, Math.min(40, Math.floor(pages / 1.5)));

/**
 * The next scale to try, by bisection between the last one too small (pages under the count) and the last one too big.
 * Returns null when the bounds have closed in (the count can't be met by the type alone).
 */
export function nextScale(lo: number, hi: number) {
  return hi - lo < 0.015 ? null : Math.round(((lo + hi) / 2) * 1000) / 1000;
}

/** How much to grow (> 1) or cut (< 1) the words when the type at its limit still misses the count. */
export const refitRatio = (want: number, got: number, front: number) => Math.max(0.3, Math.min(3, (want - front) / Math.max(1, got - front)));

/** Words of a text (Arabic or not). */
export const countWords = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** How much one chapter may grow or shrink to absorb a missed page count before more chapters are touched. */
export const RESIZE_MOST = 0.5;

/**
 * Which chapters to make longer or shorter when the type at its limit still misses the count, and to how many words:
 * the chapters with the most material first (they have the most to give or to say), as FEW as can absorb the difference
 * within RESIZE_MOST each — usually one or two — instead of every chapter written again. A miss too big for that is
 * shared by all the chapters in proportion (as before). `words`: each chapter's words now; `weights`: its material.
 */
export function resizeTargets(words: number[], weights: number[], ratio: number): { i: number; words: number }[] {
  const total = words.reduce((a, b) => a + b, 0);
  const delta = Math.round(total * (ratio - 1));
  if (!words.length || Math.abs(delta) < 20) return [];
  const order = words.map((_, i) => i).sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0) || words[b] - words[a]);
  const picked: number[] = [];
  let room = 0;
  for (const i of order) {
    picked.push(i);
    room += words[i] * RESIZE_MOST;
    if (room >= Math.abs(delta)) break;
  }
  const base = picked.reduce((s, i) => s + words[i], 0) || 1;
  return picked.map((i) => ({ i, words: Math.max(40, Math.round(words[i] + (delta * words[i]) / base)) })).filter((t) => t.words !== words[t.i]);
}
