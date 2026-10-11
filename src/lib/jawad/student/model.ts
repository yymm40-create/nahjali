// «الطالب الذكي» — the content shapes shared by the server (generation, rendering) and the pages. No server imports.

/** One block of written content. A flat shape (every field always present) so Claude's JSON schema stays simple. */
export interface Block {
  t: "h" | "p" | "list" | "note" | "term" | "quote" | "addition" | "research" | "cards" | "steps" | "compare" | "question" | "scene" | "image";
  text: string;
  title: string;
  items: { title: string; text: string }[];
  rows: string[][];
  /** research blocks: indexes of the research sources */
  sources: number[];
  /** ids (8 characters) of the material's segments this block comes from */
  segments: string[];
}

export interface Chapter {
  title: string;
  blocks: Block[];
}

export interface Doc {
  title: string;
  subtitle: string;
  chapters: Chapter[];
}

/** «خطبة المنبر»: one of the three topics proposed (the method's step 2), with the key verse as the Quran itself gives it. */
export interface SermonTopic {
  /** the pivot idea (فكرة المحور) */
  title: string;
  /** the subject of its treatment (موضوع المعالجة) */
  idea: string;
  verse: { surah: number; from: number; to: number; /** e.g. «سورة الأحزاب: ٣٣» */ ref: string; /** the Quran's own words (never the model's) */ text: string };
  /** the takhallus point (الكَوْريز) that joins the topic to the calamity */
  kooriz: string;
}

/** The verse's tafsir (the method's step 3): the passage as the book has it, and the same in plain words, with where it comes from. */
export interface SermonTafsir {
  /** «مجمع البيان في تفسير القرآن — الطبرسي — ج٨، ص١٥٥–١٥٧» */
  source: string;
  /** the link to the first page, when there is one */
  url: string;
  /** the book's own words (the pages that hold the verse's tafsir) */
  excerpt: string;
  /** the same, ordered and in plain words, with the pages marked */
  simple: string;
  /** the preacher pasted it himself */
  manual: boolean;
}

/** Lines taken from the owner's reference (مرجع الأشعار), copied exactly, with the page they are on. */
export interface SermonPoem {
  /** the verse(s), word for word */
  text: string;
  /** the poet, only when the page prints him */
  poet: string;
  /** the number printed on the page (or its place in the file) */
  page: string;
  /** the reference's name */
  ref: string;
  /** why it suits the sermon */
  why: string;
}

export interface SermonPlan {
  /** the poetry the preacher approved from the reference (the method's step 4) */
  poems?: SermonPoem[];
  topics: SermonTopic[];
  /** the topic the preacher picked (-1 = not yet) */
  chosen: number;
  tafsir: SermonTafsir | null;
}

/** The plan of a written output / book: chapters with the segments each one draws on. */
export interface DocPlan {
  title: string;
  subtitle: string;
  /** only «خطبة المنبر»: the topics, the pick and the tafsir (the chapters are the sermon's four parts) */
  sermon?: SermonPlan;
  chapters: { title: string; purpose: string; segments: string[]; image: ImageChoice }[];
}

export interface ImageChoice {
  mode: "none" | "own" | "generate";
  /** own: a picture the student uploaded (source id); generate: what to draw */
  sourceId: string;
  prompt: string;
  /** set once made / chosen: a path in the student bucket */
  path: string;
}

export interface Slide {
  title: string;
  idea: string;
  layout: "title" | "bullets" | "cards" | "quote" | "compare" | "image" | "section";
  text: string[];
  visual: string;
  notes: string;
  relation: string;
  segments: string[];
  image: ImageChoice;
  /** slides made as pictures (GPT Image 2): the drawn picture and what it was drawn from */
  rendered?: { path: string; sig: string } | null;
}

export interface SlidePlan {
  title: string;
  subtitle: string;
  slides: Slide[];
}

export interface Question {
  type: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  segments: string[];
}

export interface QuizPlan {
  rows: { topic: string; segments: string[]; counts: Record<string, number> }[];
}

export interface AudioPlan {
  files: { title: string; original: string; text: string }[];
}

export const emptyImage = (): ImageChoice => ({ mode: "none", sourceId: "", prompt: "", path: "" });

export const BLOCK_TYPES = ["h", "p", "list", "note", "term", "quote", "addition", "research", "cards", "steps", "compare", "question", "scene", "image"] as const;

/** Plain text of a document (copy, audio source). */
export function docText(d: Doc) {
  const out: string[] = [d.title];
  for (const c of d.chapters) {
    out.push("", c.title);
    for (const b of c.blocks) {
      if (b.title) out.push(b.title);
      if (b.text) out.push(b.text);
      for (const it of b.items) out.push(`${it.title ? `${it.title}: ` : ""}${it.text}`);
      for (const r of b.rows) out.push(r.join(" | "));
    }
  }
  return out.join("\n").trim();
}
