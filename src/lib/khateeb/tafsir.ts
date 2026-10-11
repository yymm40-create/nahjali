// «الخطيب الذكي» — the verse's tafsir, the method's step 3: «لا تدع الذكاء الاصطناعي يفسر الآية من تلقاء نفسه؛ بل اذهب إلى
// التفاسير الرصينة». Here the pages of «مجمع البيان» (الطبرسي) on ablibrary.net that hold the tafsir of a verse are found and read
// — the book's own words, with the printed page numbers and a link — and the writer then puts them in plain words (outputs.ts).
// How a verse is found: each volume's table of contents lists the surahs and, under them, the groups of verses with the page each
// one starts on; the verses of the surah (from the Quran text) tell which group a verse is in. No model is asked where the page is.
// Server only.

import { ablibraryUrl, MAJMA } from "@config/jawad/khateeb";
import { pages as bookPages, searchPages, toc, type TocItem } from "./ablibrary";
import { allVerses } from "./quran";

/** Arabic without marks and the spellings that differ between texts (the alef, the ya, the ta marbuta), to compare a heading with a verse. */
export const norm = (s: string) =>
  s
    .replace(/[ً-ٰٟۖ-ۭـ]/g, "")
    .replace(/[إأآٱا]/g, "")
    .replace(/[ىئ]/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/ء/g, "")
    .replace(/[^ء-ي\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** The words for the book's own search: the marks taken off and every alef form made a plain alef (nothing else changed). */
export const plain = (s: string) =>
  s
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "")
    .replace(/[ٱآأإ]/g, "ا")
    .replace(/\s+/g, " ")
    .trim();

export interface Section {
  bookId: number;
  volume: number;
  /** the group's heading (the verses it opens with) */
  title: string;
  /** the page it starts on (the site's place number) */
  page: number;
  /** the page the next group starts on (the last page this group's text can reach) */
  until: number;
  /** the first verse of the group, found in the Quran's text */
  surah: number;
  ayah: number;
}

let index: Promise<Section[] | null> | null = null;

/**
 * Every group of verses of the book with where it starts in the Quran, in the mushaf's order (kept for the life of the server).
 * The contents of the ten volumes list the groups by their opening words; each is found in the Quran's text going forward, so
 * the surahs need no heading of their own (some volumes name them, some don't).
 */
export function sections(): Promise<Section[] | null> {
  index ??= build().then((r) => {
    if (!r) index = null;
    return r;
  });
  return index;
}

/** The words a heading opens with (the surah's name line and «… إلى قوله …» cut away). */
export function openingWords(title: string): string[] {
  const lines = title.split("\n");
  const rest = /^سورة\s/.test(lines[0]) && lines.length > 1 ? lines.slice(1).join(" ") : lines.join(" ");
  return norm(rest.split(/\s*[،؛]?\s*إلى قوله/)[0]).split(" ").filter(Boolean).slice(0, 5);
}

/** Where in the verses a heading's opening words are (up to a few places; none when there are too many to tell). */
export function candidates(verses: string[], words: string[]): number[] {
  for (const n of [5, 4, 3]) {
    if (words.length < n) continue;
    const key = words.slice(0, n).join(" ");
    const at: number[] = [];
    for (let i = 0; i < verses.length; i++) if (verses[i].includes(key)) at.push(i);
    if (at.length) return at.length <= 12 ? at : [];
  }
  return [];
}

/**
 * Which verse each heading starts at: every heading proposes the verses it could open with, and the longest run that keeps
 * going forward through the Quran is taken (a wrong guess breaks the order, so it falls out). `null` for a heading left out.
 */
export function align(choices: number[][]): (number | null)[] {
  const tails: number[] = [];
  const tailNode: number[] = [];
  const nodes: { item: number; pos: number; prev: number }[] = [];
  choices.forEach((cands, item) => {
    // the largest first, so one heading is never used twice in a run
    for (const pos of [...cands].sort((a, b) => b - a)) {
      let lo = 0;
      let hi = tails.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (tails[mid] < pos) lo = mid + 1;
        else hi = mid;
      }
      nodes.push({ item, pos, prev: lo > 0 ? tailNode[lo - 1] : -1 });
      tails[lo] = pos;
      tailNode[lo] = nodes.length - 1;
    }
  });
  const out: (number | null)[] = choices.map(() => null);
  for (let n = tails.length ? tailNode[tails.length - 1] : -1; n >= 0; n = nodes[n].prev) out[nodes[n].item] = nodes[n].pos;
  return out;
}

async function build(): Promise<Section[] | null> {
  const quran = await allVerses();
  const verses = quran.map((v) => norm(v.text));
  const heads: { bookId: number; volume: number; title: string; page: number; until: number }[] = [];
  for (let v = 0; v < MAJMA.volumes.length; v++) {
    const bookId = MAJMA.volumes[v];
    const items = await toc(bookId);
    if (!items?.length) return null;
    items.forEach((it: TocItem, i) => heads.push({ bookId, volume: v + 1, title: it.title, page: it.page, until: items[i + 1]?.page ?? it.page + 2 }));
  }
  const at = align(heads.map((h) => candidates(verses, openingWords(h.title))));
  const out: Section[] = [];
  heads.forEach((h, i) => {
    const pos = at[i];
    if (pos !== null) out.push({ ...h, surah: quran[pos].surah, ayah: quran[pos].ayah });
  });
  // most of the book's groups must have been found, or the contents are not what was expected
  return out.length > 500 ? out : null;
}

export interface Found {
  bookId: number;
  volume: number;
  /** the page numbers (the site's) read, in order */
  numbers: number[];
  firstPage: number;
  /** the pages as the book has them, with the number printed on each */
  pages: { number: number; label: string; text: string }[];
  /** «مجمع البيان في تفسير القرآن — أبو علي الفضل بن الحسن الطبرسي — ج٨، ص١٥٥–١٥٧» */
  source: string;
  url: string;
}

const MAX_PAGES = 6;
const ar = (n: string | number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

/** The pages as a found tafsir (the printed numbers, the source line and the link). */
function found(bookId: number, volume: number, first: number, got: { number: number; label: string; text: string }[]): Found {
  const labels = got.map((p) => p.label);
  const range = labels.length > 1 && labels[0] !== labels[labels.length - 1] ? `ص${ar(labels[0])}–${ar(labels[labels.length - 1])}` : `ص${ar(labels[0])}`;
  return {
    bookId,
    volume,
    numbers: got.map((p) => p.number),
    firstPage: first,
    pages: got.map((p) => ({ number: p.number, label: p.label, text: p.text })),
    source: `${MAJMA.title} — ${MAJMA.author} — ج${ar(volume)}، ${range}`,
    url: ablibraryUrl(bookId, first),
  };
}

/**
 * The pages of «مجمع البيان» that hold the tafsir of this verse, or null when they can't be found (the preacher then pastes
 * them). `words`: the verse's opening words as plain text, for a surah the contents don't list the verses of (a short one):
 * the book's own search then looks for them between the groups found on either side.
 */
export async function findTafsir(surah: number, ayah: number, words = ""): Promise<Found | null> {
  const all = await sections();
  if (!all) return null;
  // the last group that starts at or before the verse, and the first one after it
  let at = -1;
  all.forEach((s, i) => {
    if (s.surah < surah || (s.surah === surah && s.ayah <= ayah)) at = i;
  });
  // before the first group found (the opening surah): from the first volume's start
  const sec = at < 0 ? { bookId: MAJMA.volumes[0], volume: 1, page: 0, until: 0, surah: 0, ayah: 0, title: "" } : all[at];
  if (at >= 0 && sec.surah === surah) {
    const first = sec.page;
    const last = Math.min(Math.max(sec.until, first), first + MAX_PAGES - 1);
    const got = await bookPages(sec.bookId, Array.from({ length: last - first + 1 }, (_, i) => first + i));
    return got?.length ? found(sec.bookId, sec.volume, first, got) : null;
  }
  // the surah's groups were not found in the contents: its words are searched between the neighbours (the volume of the group
  // before it up to the volume of the one after it)
  const next = all[at + 1];
  const q = plain(words).split(" ").filter(Boolean).slice(0, 6).join(" ");
  if (!q) return null;
  for (let v = sec.volume; v <= (next?.volume ?? sec.volume); v++) {
    const bookId = MAJMA.volumes[v - 1];
    const hits = await searchPages(bookId, q);
    // only a page that really holds the verse's words (the search also answers with pages that merely share some of them)
    const inside = (hits ?? []).filter((p) => (v > sec.volume || p.number >= sec.page) && (!next || v < next.volume || p.number <= next.page) && norm(p.text).includes(norm(q))).sort((a, b) => a.number - b.number);
    if (!inside.length) continue;
    const first = inside[0].number;
    const got = await bookPages(bookId, Array.from({ length: MAX_PAGES - 2 }, (_, i) => first + i));
    if (got?.length) return found(bookId, v, first, got);
  }
  return null;
}
