// «الطالب الذكي» — how many pages GPT Image 2 draws, and who may start it. The number the student CHOSE rules: the written
// output is cut into exactly that many designed pages (pictures.ts), and drawing is paid, so it is never started on its own
// when the student chose no number — it waits for the button that shows the page count and the price first.
// Pure: the page's autopilot, the server's action and the tests all use it.

import { pagesOf } from "@config/jawad/student";

/** The outputs that have the question «كم صفحة تبي؟»: their drawn pages are exactly the number chosen. */
export const COUNTED_KINDS: readonly string[] = ["summary", "explain", "preread", "book"];

/** The page count the student chose for an output (0: none — «حسب المادة», or a kind with no such question). */
export const chosenPages = (kind: string, settings: Record<string, unknown>) => (COUNTED_KINDS.includes(kind) ? pagesOf(settings) : 0);

/**
 * May the autopilot start the drawing by itself (it confirms the payment for the student)? Only when the student chose
 * the number of pages: then what is drawn is exactly that number. A transcript or a quiz has no such number, and a
 * written output left at «حسب المادة» has as many pages as its words make: those are drawn only from the button that
 * says how many and what it costs.
 */
export const mayAutoDraw = (kind: string, settings: Record<string, unknown>) => chosenPages(kind, settings) > 0;

/** What the page says before anything is paid: «٥ صفحات»; the exact count is the server's (it cuts the text). */
export const drawNote = (pages: number, todo: number) =>
  todo === pages ? `ستُرسم ${pages} ${pages === 1 ? "صفحة" : "صفحات"} بـ GPT Image 2` : `ستُرسم ${todo} من ${pages} صفحات (الباقي مرسوم ولم يتغيّر)`;

/**
 * A slide map with more slides than the student asked for, cut to their number: the first ones in order, and the last
 * slide kept as the closing one. Fewer than asked stay as they are (nothing is invented). Pure.
 */
export function capSlides<T>(slides: T[], want: number): T[] {
  const n = Math.max(0, Math.round(want));
  if (!n || slides.length <= n) return slides;
  return n === 1 ? slides.slice(0, 1) : [...slides.slice(0, n - 1), slides[slides.length - 1]];
}
