// «مسبار القارئ» (الشيخ حسن البلوشي): a reading guide of three dimensions → fields → topics → levels → books.
// The guide ships with the site (data.json). Each book has a fixed id «<field>-<n>»: the database (my list, a book's PDF)
// keeps that id, so when the guide grows, add new books at the END of a field and never renumber the others.
import data from "./data.json";

export const GUIDE_NAME = "مسبار القارئ";
export const GUIDE_BY = "الشيخ حسن البلوشي";

export interface GuideBookData {
  id: string;
  t: string;
  a: string;
  /** 0 مبتدئ · 1 متوسط · 2 متقدم */
  l: number;
  /** Added recently to the guide */
  new?: number;
  /** The book's page on «شبكة الفكر» */
  src?: string;
}
export interface GuideTopic {
  n: string;
  b: GuideBookData[];
}
export interface GuideField {
  k: string;
  n: string;
  d: string;
  topics: GuideTopic[];
}
export interface GuideDimension {
  k: string;
  n: string;
  d: string;
  domains: GuideField[];
}

export const GUIDE = data as GuideDimension[];

export const LEVELS = ["مبتدئ", "متوسط", "متقدم"] as const;
export const LEVEL_HINTS = ["مدخل ميسّر للبداية", "توسّع وتعمّق في الموضوع", "دراسة تخصصية وبحثية"] as const;

export type GuideStatus = "want" | "now" | "read";
export const STATUSES: GuideStatus[] = ["want", "now", "read"];

/** One book where it sits in the guide. `key` is the id of its first place (a book listed under two topics shares it). */
export interface GuideBook {
  id: string;
  key: string;
  title: string;
  author: string;
  level: number;
  isNew: boolean;
  src: string;
  /** dimension, field and topic indexes */
  xi: number;
  di: number;
  ti: number;
  dim: string;
  field: string;
  fieldKey: string;
  topic: string;
}

/** Arabic text for search: no hamza forms, tashkeel or tatweel; ة→ه, ى→ي. */
export const normGuide = (s: string) =>
  String(s)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[ؤ]/g, "و")
    .replace(/[ئ]/g, "ي")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[٫.،,:؛"«»()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const same = (b: GuideBookData) => normGuide(`${b.t}|${b.a}`);

function flatten(): GuideBook[] {
  const first = new Map<string, string>();
  const all: GuideBook[] = [];
  GUIDE.forEach((D, xi) =>
    D.domains.forEach((M, di) =>
      M.topics.forEach((T, ti) =>
        T.b.forEach((b) => {
          const s = same(b);
          if (!first.has(s)) first.set(s, b.id);
          all.push({ id: b.id, key: first.get(s)!, title: b.t, author: b.a, level: b.l, isNew: Boolean(b.new), src: b.src ?? "", xi, di, ti, dim: D.n, field: M.n, fieldKey: M.k, topic: T.n });
        }),
      ),
    ),
  );
  return all;
}

export const GUIDE_BOOKS = flatten();
const BY_ID = new Map(GUIDE_BOOKS.map((b) => [b.id, b]));
export const guideBook = (id: string) => BY_ID.get(id);
/** The ids that hold a status or a PDF (one per distinct book). */
export const GUIDE_KEYS = new Set(GUIDE_BOOKS.map((b) => b.key));
export const isGuideKey = (id: unknown): id is string => typeof id === "string" && GUIDE_KEYS.has(id);
/** Distinct books in the guide. */
export const guideCount = () => GUIDE_KEYS.size;

const INDEX = GUIDE_BOOKS.map((b) => normGuide(`${b.title} ${b.author} ${b.topic} ${b.field} ${b.dim}${b.isNew ? " مضاف حديثا" : ""}`));

/** Books matching every word of `q` (title, author, topic, field, dimension), one row per distinct book. */
export function searchGuide(q: string, limit = 60): GuideBook[] {
  const words = normGuide(q).split(" ").filter(Boolean);
  if (!words.length) return [];
  const seen = new Set<string>();
  const out: GuideBook[] = [];
  GUIDE_BOOKS.forEach((b, i) => {
    if (seen.has(b.key) || !words.every((w) => INDEX[i].includes(w))) return;
    seen.add(b.key);
    out.push(b);
  });
  // Title matches first
  const inTitle = (b: GuideBook) => words.every((w) => normGuide(b.title).includes(w));
  return out.sort((a, b) => Number(inTitle(b)) - Number(inTitle(a))).slice(0, limit);
}

/** Books of the same topic at my level or the next one. */
export const nextUp = (b: GuideBook) =>
  GUIDE_BOOKS.filter((x) => x.xi === b.xi && x.di === b.di && x.ti === b.ti && x.key !== b.key && (x.level === b.level || x.level === b.level + 1)).slice(0, 5);

/** Other books by the same author (one per distinct book). */
export function sameAuthor(b: GuideBook) {
  if (!b.author) return [];
  const seen = new Set<string>();
  return GUIDE_BOOKS.filter((x) => x.author === b.author && x.key !== b.key && !seen.has(x.key) && (seen.add(x.key), true)).slice(0, 6);
}

/** The picture of a field. */
export const fieldImage = (fieldKey: string) => `/mahdi/guide/${fieldKey}.webp`;
