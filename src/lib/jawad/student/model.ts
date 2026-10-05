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

/** The plan of a written output / book: chapters with the segments each one draws on. */
export interface DocPlan {
  title: string;
  subtitle: string;
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
