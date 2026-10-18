// «حيدرا ماكس» — an output's content as PAGES to design (see deck-make.ts): the briefs the designer receives, one per
// page, and a signature of each one's content. Pure: no model, no server — so the pagination, the quiz sheets and the
// brochure sides are tested on their own.

import { foldOf, pagesOf } from "@config/jawad/student";
import { MAP_TYPES, type MindMap } from "./mindmap";
import type { Block, BrochurePlan, Doc, DocPlan, Question, SlidePlan } from "./model";
import type { MaxSource } from "./deck-make";
import type { SlideBrief } from "@/lib/slides/design";
import { sigOf } from "@/lib/slides/format";

const words = (t: string) => t.split(/\s+/).filter(Boolean).length;
const brief = (b: Partial<SlideBrief> & { title: string; text: string[] }): SlideBrief => ({ idea: "", layout: "page", notes: "", visual: "", image: null, ...b });

// ───────────────────────────── slides ─────────────────────────────

export function slidesSource(plan: SlidePlan, settings: Record<string, unknown> = {}): MaxSource {
  const briefs = plan.slides.map((s) => brief({ title: s.title, idea: s.idea, layout: s.layout, text: s.text.filter(Boolean), notes: s.notes, visual: s.visual, image: s.image.path ? { token: `img:${s.image.path}`, alt: s.image.prompt || s.visual || s.title } : null }));
  return {
    title: plan.title,
    aspect: settings.aspect === "4:3" ? "4:3" : "16:9",
    briefs,
    sigs: plan.slides.map((s) => sigOf({ t: s.title, x: s.text, l: s.layout, v: s.visual, p: s.image.path })),
    purpose: "A presentation (slides): each slide carries one idea; the speaker's notes carry the explanation.",
  };
}

// ───────────────────────────── written documents ─────────────────────────────

/** A block as the lines it prints. */
export function blockLines(b: Block): string[] {
  const it = (x: { title: string; text: string }) => (x.title ? `${x.title}: ${x.text}` : x.text);
  switch (b.t) {
    case "h":
      return [`## ${b.text || b.title}`];
    case "list":
      return b.items.map((x) => `• ${it(x)}`);
    case "note":
      return [`ملاحظة: ${b.text}`];
    case "term":
      return [`المصطلح «${b.title}»: ${b.text}`];
    case "quote":
      return [`«${b.text}»${b.title ? ` — ${b.title}` : ""}`];
    case "addition":
      return [`إضافة: ${b.text}`];
    case "research":
      return [`من البحث: ${b.text}`];
    case "cards":
      return b.items.map((x) => `[بطاقة] ${it(x)}`);
    case "steps":
      return b.items.map((x, i) => `${i + 1}. ${it(x)}`);
    case "compare":
      return b.rows.map((r, i) => `${i === 0 ? "[جدول — الصف الأول عناوين] " : "[جدول] "}${r.join(" | ")}`);
    case "question":
      return [`سؤال مراجعة: ${b.text}`];
    case "scene":
      return [`${b.title ? `${b.title}: ` : ""}${b.text}`];
    case "image":
      return [];
    default:
      return b.text ? [b.text] : [];
  }
}

interface Item {
  lines: string[];
  words: number;
  head?: boolean;
}

/** Long paragraphs are cut at sentence ends so no single piece is more than a page. */
function split(text: string, max: number): string[] {
  if (words(text) <= max) return [text];
  const sentences = text.split(/(?<=[.؟?!۔])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && words(cur) + words(s) > max) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * The items spread over pages: about `per` words a page (or, when the student asked for N pages, the total shared evenly so
 * the file comes out with N); a heading never ends a page.
 */
export function paginate(items: Item[], pages: number, per = 230): string[][] {
  const flat: Item[] = [];
  for (const it of items) {
    if (!it.head && it.lines.length === 1 && it.words > per) for (const part of split(it.lines[0], Math.round(per * 0.85))) flat.push({ lines: [part], words: words(part) });
    else flat.push(it);
  }
  const total = flat.reduce((n, x) => n + x.words, 0);
  const target = pages > 0 ? Math.max(60, Math.ceil(total / pages)) : per;
  const out: string[][] = [];
  let cur: string[] = [];
  let w = 0;
  const flush = () => {
    if (cur.length) out.push(cur);
    cur = [];
    w = 0;
  };
  flat.forEach((it, i) => {
    const last = pages > 0 && out.length >= pages - 1;
    const need = it.words + (it.head ? (flat[i + 1]?.words ?? 0) : 0);
    if (!last && cur.length && w + need > target * 1.12) flush();
    cur.push(...it.lines);
    w += it.words;
  });
  flush();
  return out;
}

const PURPOSE: Record<string, string> = {
  summary: "A printed SUMMARY a student studies from: the essential ideas, easy to scan and revise (headings, short paragraphs, key terms in boxes).",
  explain: "A printed EXPLANATION a student reads to understand a topic: examples and terms stand out, the order of ideas is clear.",
  preread: "A printed PRE-READING sheet handed out before a lesson: inviting, the big picture first, key terms with their meaning, guiding questions, what to focus on; light and short to read.",
  book: "A printed READING BOOK / booklet: a cover page, then the chapters; calm and consistent so it can be read for a long time.",
  transcript: "The FULL TRANSCRIPT of a lesson or recording, printed: it is VERBATIM — every word as given, in order; the design only makes it comfortable to read (clear paragraphs, the section labels as headings).",
  sermon: "A SERMON text the preacher reads ALOUD from the minbar, printed: BIG type (body about 40–46 px), wide line spacing, short paragraphs, verses and poetry set apart clearly, almost no decoration (a thin header line and the page number) — nothing that distracts a reader glancing down from the audience.",
};

/** A written document (summary, explanation, pre-reading, book, sermon, transcript) as A4 pages. */
export function docSource(kind: string, settings: Record<string, unknown>, doc: Doc, plan?: DocPlan | null): MaxSource {
  const items: Item[] = [];
  for (const ch of doc.chapters) {
    if (ch.title) items.push({ lines: [`# ${ch.title}`], words: words(ch.title) + 12, head: true });
    for (const b of ch.blocks) {
      const lines = blockLines(b);
      if (!lines.length) continue;
      items.push({ lines, words: lines.reduce((n, l) => n + words(l), 0), head: b.t === "h" });
    }
  }
  const cover = kind === "book";
  const pages = Math.max(0, pagesOf(settings) - (cover ? 1 : 0));
  const per = kind === "sermon" ? 150 : 230;
  const chunks = paginate(items, pages, per);
  const briefs: SlideBrief[] = [];
  if (cover) briefs.push(brief({ title: doc.title, layout: "cover", text: [doc.title, doc.subtitle].filter(Boolean), idea: "The cover page of the book: the title large, the subtitle, a strong graphic idea from the palette." }));
  chunks.forEach((lines, i) => {
    const title = lines.find((l) => l.startsWith("# "))?.slice(2) ?? doc.title;
    // a chapter's picture goes on the page that opens it
    const chIdx = plan?.chapters.findIndex((c) => c.title && lines.some((l) => l === `# ${c.title}`)) ?? -1;
    const img = chIdx >= 0 ? plan?.chapters[chIdx].image : null;
    briefs.push(brief({
      title,
      layout: i === 0 && !cover ? "first page" : "page",
      idea: i === 0 && !cover ? `The first page: the document's title «${doc.title}»${doc.subtitle ? ` and its line «${doc.subtitle}»` : ""} at the top, then the content.` : "",
      text: lines.map((l) => (l.startsWith("# ") ? `[chapter heading] ${l.slice(2)}` : l.startsWith("## ") ? `[sub-heading] ${l.slice(3)}` : l)),
      image: img?.path ? { token: `img:${img.path}`, alt: img.prompt || title } : null,
    }));
  });
  return {
    title: doc.title,
    aspect: "a4",
    briefs,
    sigs: briefs.map((b) => sigOf({ t: b.title, x: b.text, i: b.image?.token ?? "", l: b.layout })),
    purpose: `${PURPOSE[kind] ?? PURPOSE.summary} The document has ${briefs.length} pages — put "page N of ${briefs.length}" in the footer.`,
  };
}

// ───────────────────────────── a quiz ─────────────────────────────

const TYPE_AR: Record<string, string> = { mcq: "اختيار من متعدد", tf: "صح أو خطأ", short: "إجابة قصيرة", essay: "مقالي", long: "إجابة طويلة", custom: "سؤال" };
const SPACE: Record<string, number> = { short: 2, essay: 6, long: 10 };
const LETTERS = ["أ", "ب", "ج", "د", "هـ", "و"];

/** The questions as sheets (5 a page) and, after them, the answer key (8 a page); the answer pages have ids «ans…». */
export function quizSource(title: string, questions: Question[]): MaxSource {
  const sheets: SlideBrief[] = [];
  for (let i = 0; i < questions.length; i += 5) {
    const part = questions.slice(i, i + 5);
    const text: string[] = i === 0 ? [`[header of the sheet] الاسم: ................ الصف: ........ التاريخ: ........ الدرجة: ...... / ${questions.length}`] : [];
    part.forEach((q, k) => {
      const n = i + k + 1;
      text.push(`${n}) ${q.question} [${TYPE_AR[q.type] ?? q.type}]`);
      if (q.type === "mcq" || q.options.length > 1) q.options.forEach((o, j) => text.push(`   ${LETTERS[j] ?? j + 1}) ${o}`));
      else if (q.type === "tf") text.push("   ( ) صح      ( ) خطأ");
      if (SPACE[q.type]) text.push(`[leave ${SPACE[q.type]} ruled lines to write the answer]`);
    });
    sheets.push(brief({ id: `q${sheets.length + 1}`, title, layout: "quiz sheet", text, idea: i === 0 ? `The first sheet: the title «${title}» and the header fields at the top.` : "" }));
  }
  const answers: SlideBrief[] = [];
  for (let i = 0; i < questions.length; i += 8) {
    const text = questions.slice(i, i + 8).map((q, k) => `${i + k + 1}) ${q.answer}${q.explanation ? ` — ${q.explanation}` : ""}`);
    answers.push(brief({ id: `ans${answers.length + 1}`, title: `${title} — مفتاح الإجابة`, layout: "answer key", text, idea: i === 0 ? "The first answer-key page: the title «مفتاح الإجابة» at the top (for the teacher: a compact table-like list)." : "" }));
  }
  const briefs = [...sheets, ...answers];
  return {
    title,
    aspect: "a4",
    briefs,
    sigs: briefs.map((b) => sigOf({ t: b.title, x: b.text, l: b.layout })),
    purpose: "A printed QUIZ: the question sheets are handed to students (clear numbering, the options aligned, ruled lines to write on, an even calm look) and the answer key is for the teacher (compact, scannable).",
  };
}

// ───────────────────────────── a mind map ─────────────────────────────

/** A mind map as a tree of lines, and what shape to draw it in. */
export function mapLines(m: MindMap): string[] {
  const out = [`[centre] ${m.center}`];
  for (const b of m.branches) {
    out.push(`[branch] ${b.label}${b.icon ? ` (icon: ${b.icon})` : ""}${b.link ? ` — linking phrase: ${b.link}` : ""}`);
    for (const c of b.children) {
      out.push(`   [sub-branch] ${c.label}${c.link ? ` — linking phrase: ${c.link}` : ""}`);
      for (const d of c.details) out.push(`      [detail] ${d}`);
    }
  }
  for (const l of m.links) out.push(`[cross-link] ${l.from} ⟷ ${l.to}: ${l.label}`);
  return out;
}

export function mindSource(maps: MindMap[]): MaxSource {
  const briefs = maps.map((m, i) =>
    brief({
      id: `map${i + 1}`,
      title: m.title,
      layout: "mind map",
      text: mapLines(m),
      visual: MAP_TYPES.find((t) => t.id === m.type)?.en ?? "",
      idea: `Draw this as ONE diagram filling the A4 landscape page (the title small at the top), as inline SVG for the lines and shapes with the words in <p> boxes over it: ${MAP_TYPES.find((t) => t.id === m.type)?.en ?? "a mind map"}. One colour per main branch from the palette, branch lines thick at the centre and thinner outwards, a simple line icon (SVG) beside a main branch that has one, every word of the map written once, nothing overlapping.`,
    }),
  );
  return {
    title: maps[0]?.title ?? "خريطة ذهنية",
    aspect: "a4l",
    briefs,
    sigs: maps.map((m) => sigOf({ c: m.center, b: m.branches, l: m.links, t: m.type })),
    purpose: "A MIND MAP a student studies and redraws from memory: a clear diagram, large readable words, structure obvious at a glance (printed on A4 landscape).",
  };
}

// ───────────────────────────── a brochure ─────────────────────────────

/** The panel numbers on each side of the sheet, left → right as the sheet lies in front of you (Arabic folds). */
export const BROCHURE_SIDES: Record<"tri" | "bi", { outside: number[]; inside: number[] }> = {
  tri: { outside: [1, 6, 5], inside: [4, 3, 2] },
  bi: { outside: [1, 4], inside: [3, 2] },
};

const ROLE_AR = { cover: "الغلاف", flap: "اللسان الأمامي", content: "محتوى", back: "الخلفية" } as const;

/** The two sides of a brochure as pages. A side lists its panels RIGHT → LEFT, the order a right-to-left row lays them out. */
export function brochureSource(plan: BrochurePlan): MaxSource {
  const sides = BROCHURE_SIDES[plan.fold === "bi" ? "bi" : "tri"];
  const side = (nums: number[], name: string, id: string): SlideBrief => {
    const rtl = [...nums].reverse();
    const text: string[] = [];
    rtl.forEach((n, k) => {
      const p = plan.panels[n - 1];
      if (!p) return;
      text.push(`[column ${k + 1} from the RIGHT = panel ${n}, ${ROLE_AR[p.role]}] ${p.title}`);
      for (const l of p.text) text.push(`   ${l}`);
      if (p.image.path) text.push(`   PICTURE for this panel: <img src="img:${p.image.path}" alt="${(p.image.prompt || p.visual || p.title).replace(/"/g, "'")}">`);
      else if (p.visual) text.push(`   [proposed visual: ${p.visual}]`);
    });
    return brief({ id, title: `${plan.title} — ${name}`, layout: "brochure side", text, idea: `${name}: the sheet is split into ${nums.length} EQUAL columns, ${(1123 * 2) / nums.length} px wide each (the whole canvas is 2246 px wide), column 1 at the RIGHT edge. Each column is one panel: keep ~70 px of safe margin inside every column (the folds fall on the column edges and the printer cuts the sheet's edge) and never let a heading or a picture cross a fold line. A thin dashed fold mark at the top of each fold is welcome.` });
  };
  const briefs = [side(sides.outside, "الوجه الأول (الخارجي)", "out"), side(sides.inside, "الوجه الثاني (الداخلي)", "in")];
  return {
    title: plan.title,
    aspect: "a4l",
    briefs,
    sigs: briefs.map((b) => sigOf({ t: b.title, x: b.text, l: plan.fold })),
    purpose: `A school BROCHURE (مطوية): one A4 sheet, landscape, printed on both sides and folded ${plan.fold === "bi" ? "in two" : "in three"}. Arabic folds, panel numbers = reading order: 1 cover${plan.fold === "bi" ? ", 2 and 3 content, 4 back" : ", 2·3·4 content, 5 front flap, 6 back"}. The cover is striking and tells the topic at a glance; the content panels are short, scannable, visual (icons, numbers, boxes); a «هل تعلم؟» box and the sources are welcome. Bright, friendly, printable.`,
  };
}

/** How many panels a brochure's fold has. */
export const panelCount = (settings: Record<string, unknown>) => (foldOf(settings) === "bi" ? 4 : 6);

// ───────────────────────────── what an output is, as pages ─────────────────────────────

import type { Output } from "./db";

/** The pages حيدرا ماكس designs for this output, from what it holds now (null while there is nothing to design yet). */
export function maxSourceFor(o: Output): MaxSource | null {
  const settings = o.settings;
  switch (o.kind) {
    case "slides":
      return o.plan ? slidesSource(o.plan as SlidePlan, settings) : null;
    case "quiz": {
      const q = (o.content as { questions?: Question[] } | null)?.questions;
      return q?.length ? quizSource(String(settings.title || o.title || "اختبار"), q) : null;
    }
    case "mindmap": {
      const maps = (o.plan as { maps?: MindMap[] } | null)?.maps;
      return maps?.length ? mindSource(maps) : null;
    }
    case "brochure":
      return o.plan ? brochureSource(o.plan as BrochurePlan) : null;
    case "transcript": {
      const t = o.content as { title?: string; segments?: { label: string; text: string }[] } | null;
      if (!t?.segments?.length) return null;
      const doc: Doc = {
        title: t.title ?? "تفريغ",
        subtitle: "",
        chapters: t.segments.map((s) => ({ title: s.label, blocks: s.text.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean).map((x) => ({ t: "p" as const, text: x, title: "", items: [], rows: [], sources: [], segments: [] })) })),
      };
      return docSource("transcript", settings, doc);
    }
    default: {
      const c = o.content as (Doc & { draft?: boolean }) | null;
      if (!c?.chapters?.length) return null;
      return docSource(o.kind, settings, { title: c.title, subtitle: c.subtitle, chapters: c.chapters }, o.plan as DocPlan | null);
    }
  }
}
