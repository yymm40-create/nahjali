// «الطالب الذكي» — BEFORE the content is written: does the material fill the pages the student asked for? The pages are
// the student's number and are kept exactly (pages.ts), so a material of 600 words asked to fill 37 pages can only be
// padded, and one of 20,000 words squeezed into 3 pages loses almost everything. The plan stage measures the material
// against the number and, when they don't fit, asks the student what to do — instead of writing first and finding out.
// Pure: the plan step, the page and the autopilot all use it.

import { PAGE_WORDS, frontPages, type PageSize } from "./pages";

/** How many words of finished text a kind of output makes per word of material: [least, most] for a faithful result. */
export const KIND_YIELD: Record<string, readonly [number, number]> = {
  // a summary keeps the essential ideas: a small share of the material
  summary: [0.12, 0.45],
  // a pre-reading sheet prepares for the lesson: the map and the terms, more than a summary and less than the text
  preread: [0.2, 0.6],
  // an explanation re-presents the concepts and unpacks the terms: about the size of the material, and more
  explain: [0.5, 1.6],
  // a book follows the material through, chapter by chapter
  book: [0.4, 1.5],
};

export type CapacityVerdict = "fits" | "short" | "long";

export interface Capacity {
  /** words of material (the approved text, and the research when there is some) */
  words: number;
  /** the pages the student asked for */
  pages: number;
  /** the pages the material honestly makes for this kind of output: from … to */
  least: number;
  most: number;
  /** the page count to suggest: the middle of that range */
  best: number;
  verdict: CapacityVerdict;
}

/** The pages that carry text (the cover and the contents page don't), for a count the student asked for. */
const bodyOf = (pages: number) => Math.max(1, pages - frontPages(pages, 2).count);

/**
 * Measures a material against a page count. `null` when there is nothing to measure: no number was chosen («حسب المادة»:
 * the pages follow the material), or a kind with no such question.
 */
export function capacityOf(kind: string, words: number, pages: number, size: PageSize): Capacity | null {
  const yieldOf = KIND_YIELD[kind];
  const w = Math.max(0, Math.round(Number.isFinite(words) ? words : 0));
  const asked = Math.max(0, Math.round(Number.isFinite(pages) ? pages : 0));
  if (!yieldOf || !asked) return null;
  const perPage = PAGE_WORDS[size] ?? PAGE_WORDS.A4;
  // body pages the material makes, then back to the total pages the student counts (the cover and the contents come on top)
  const bodyLeast = Math.max(1, Math.round((w * yieldOf[0]) / perPage));
  const bodyMost = Math.max(bodyLeast, Math.round((w * yieldOf[1]) / perPage));
  const total = (body: number) => {
    let t = body;
    // the front pages depend on the total, so settle it by trying (cover from 4 pages, contents from 6)
    for (let i = 0; i < 3; i++) t = body + frontPages(t, 2).count;
    return t;
  };
  const least = total(bodyLeast);
  const most = total(bodyMost);
  const best = total(Math.max(1, Math.round((bodyLeast + bodyMost) / 2)));
  const body = bodyOf(asked);
  const verdict: CapacityVerdict = body > bodyMost ? "short" : body < bodyLeast ? "long" : "fits";
  return { words: w, pages: asked, least, most, best, verdict };
}

/** Whether the plan may be approved without asking the student: nothing to measure, or the material fits the number. */
export const fitsPages = (c: Capacity | null | undefined) => !c || c.verdict === "fits";

/** Reads what the plan step kept in an output's settings (`_capacity`), or null when it isn't there or isn't well formed. */
export function readCapacity(settings: Record<string, unknown> | null | undefined): Capacity | null {
  const c = settings?._capacity as Partial<Capacity> | undefined;
  if (!c || typeof c !== "object") return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const [words, pages, least, most, best] = [n(c.words), n(c.pages), n(c.least), n(c.most), n(c.best)];
  if (words === null || pages === null || least === null || most === null || best === null) return null;
  if (c.verdict !== "fits" && c.verdict !== "short" && c.verdict !== "long") return null;
  return { words, pages, least, most, best, verdict: c.verdict };
}

/** What to say to the student, in one sentence, before anything is written. Empty when the material fits. */
export function capacityLine(c: Capacity, additionsAllowed: boolean): string {
  const range = c.least === c.most ? `${c.least}` : `${c.least} إلى ${c.most}`;
  if (c.verdict === "short") {
    return `مادتك (${c.words.toLocaleString("ar")} كلمة) تكفي لنحو ${range} صفحة، وأنت طلبت ${c.pages.toLocaleString("ar")}. ${additionsAllowed ? "عشان يوصل للعدد بيضيف صادق شروحات وأمثلة من عنده (مُعلَّمة «إضافة»)" : "عشان يوصل للعدد لازم يوسّع الكلام أو يكرره، ولو سمحت بالإضافات يضيف من عنده شروحات وأمثلة مُعلَّمة"}.`;
  }
  if (c.verdict === "long") return `مادتك (${c.words.toLocaleString("ar")} كلمة) أكبر من ${c.pages.toLocaleString("ar")} صفحات بكثير: تكفي لنحو ${range} صفحة. في ${c.pages.toLocaleString("ar")} بيختصرها صادق اختصارًا شديدًا ويترك أغلبها.`;
  return "";
}
