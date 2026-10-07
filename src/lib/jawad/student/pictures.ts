// «الطالب الذكي» — any finished written output (summary, explanation, transcript, book, quiz) turned into designed pages
// drawn by GPT Image 2, then put together as a PDF. The pages are cut from the approved content (nothing is rewritten),
// a page is drawn again only when it changed, and the student can have one page drawn again with a note.

import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { defaultDesign, fontById, pagesOf as askedPages, styleById, type Design } from "@config/jawad/student";
import { GPT_IMAGE_2_SIZES, gptImage2OutputTokens } from "@config/jawad/generators";
import { providerUserId } from "@/lib/jawad/server/providers/common";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { UserError } from "@/lib/api";
import { getFile, getOutput, putFile, saveOutput, type Output } from "./db";
import type { Handler, Job, StepResult } from "./jobs";
import type { Block, Doc, Question } from "./model";
import { colorsOf } from "./render/css";

export type PictureQuality = "medium" | "high";
const ASPECT = "2:3";

export interface PicturePage {
  title: string;
  lines: string[];
  rendered: { path: string; sig: string } | null;
}
export interface Pictures {
  quality: PictureQuality;
  pages: PicturePage[];
}

export const PICTURE_KINDS = ["summary", "explain", "transcript", "book", "quiz"];

/** USD ceiling of one page: the output at the chosen quality, a style reference and the prompt. */
export function pageUsd(quality: PictureQuality) {
  const [w, h] = GPT_IMAGE_2_SIZES.hi[ASPECT];
  return (gptImage2OutputTokens(w, h, quality) * 30 + 7100 * 8 + 2000 * 5) / 1e6;
}

const WORDS_PER_PAGE = 110;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

function blockLines(b: Block): string[] {
  const tag = b.t === "addition" ? "(إضافة) " : b.t === "research" ? "(من البحث) " : "";
  const out: string[] = [];
  if (b.t === "h") return [`## ${b.text || b.title}`];
  if (b.title && b.t !== "quote") out.push(`${tag}${b.title}${b.text ? `: ${b.text}` : ""}`);
  else if (b.text) out.push(`${tag}${b.t === "quote" ? `«${b.text}»` : b.text}`);
  for (const it of b.items) out.push(`• ${it.title ? `${it.title}: ` : ""}${it.text}`);
  for (const r of b.rows) out.push(r.join(" | "));
  return out;
}

/**
 * Exactly `n` pages (the student's page count): the whole text in order, about the same words on each page, a chapter's
 * title as the heading of the page it starts on (or the page's own chapter).
 */
function paginateTo(sections: { title: string; lines: string[] }[], n: number): PicturePage[] {
  const items = sections.flatMap((sec, k) => [
    ...(k > 0 || sections.length > 1 ? [{ title: sec.title, line: `## ${sec.title}` }] : []),
    ...sec.lines.flatMap((line) => (words(line) > 40 ? (line.match(/[^.!?؟]+[.!?؟]*\s*/g) ?? [line]) : [line]).map((x) => ({ title: sec.title, line: x.trim() }))),
  ]).filter((x) => x.line);
  const total = items.reduce((a, x) => a + words(x.line), 0);
  const pages: PicturePage[] = Array.from({ length: n }, () => ({ title: "", lines: [], rendered: null }));
  let acc = 0;
  for (const it of items) {
    // the page this line falls on by its middle word, so every page gets its share
    const w = words(it.line);
    const at = Math.min(n - 1, Math.floor(((acc + w / 2) / Math.max(1, total)) * n));
    acc += w;
    const pg = pages[at];
    if (!pg.title) pg.title = it.title;
    if (it.line.startsWith("## ") && it.line.slice(3) === pg.title && !pg.lines.length) continue;
    pg.lines.push(it.line);
  }
  // a page left empty (very short text): it carries the title page's heading only
  for (const pg of pages) if (!pg.title) pg.title = sections[0]?.title ?? "";
  return pages;
}

/** Cuts lines into pages of about WORDS_PER_PAGE words (a long line is split at sentence ends). */
function paginate(sections: { title: string; lines: string[] }[]): PicturePage[] {
  const pages: PicturePage[] = [];
  for (const sec of sections) {
    let cur: string[] = [];
    let n = 0;
    const flush = () => {
      if (cur.length) pages.push({ title: sec.title, lines: cur, rendered: null });
      cur = [];
      n = 0;
    };
    for (const line of sec.lines) {
      const parts = words(line) > WORDS_PER_PAGE ? line.match(/[^.!?؟]+[.!?؟]*\s*/g) ?? [line] : [line];
      for (const part of parts) {
        const w = words(part);
        if (n && n + w > WORDS_PER_PAGE) flush();
        cur.push(part.trim());
        n += w;
      }
    }
    flush();
  }
  return pages;
}

/** The pages of an output, from its approved content (nothing is rewritten). */
export function pagesOf(o: Output): PicturePage[] {
  if (o.kind === "transcript") {
    const c = o.content as { segments: { label: string; text: string }[] };
    return paginate(c.segments.map((s) => ({ title: s.label, lines: s.text.split(/\n+/).filter(Boolean) })));
  }
  if (o.kind === "quiz") {
    const qs = (o.content as { questions: Question[] }).questions;
    const ask = qs.map((q, i) => [`${i + 1}. ${q.question}`, ...q.options.map((op, k) => `   ${"أبجد"[k] ?? k + 1}) ${op}`)].join("\n"));
    const ans = qs.map((q, i) => `${i + 1}. ${q.answer} — ${q.explanation}`);
    return [...paginate([{ title: "الأسئلة", lines: ask }]), ...paginate([{ title: "الإجابات", lines: ans }])];
  }
  const d = o.content as Doc;
  const sections = d.chapters.map((c) => ({ title: c.title, lines: c.blocks.flatMap(blockLines) }));
  const n = askedPages(o.settings);
  return n ? paginateTo(sections, n) : paginate(sections);
}

const designOf = (o: Output): Design => (o.settings.design as Design) ?? defaultDesign(o.kind === "quiz" ? "bento" : "notebook");
const sigOf = (p: PicturePage, design: Design, quality: PictureQuality) => createHash("sha256").update(JSON.stringify([p.title, p.lines, design, quality])).digest("hex").slice(0, 16);

function prompt(o: Output, p: PicturePage, i: number, total: number, design: Design, hasRef: boolean, note: string) {
  const st = styleById(design.main);
  const c = colorsOf(design, design.main);
  const WHAT: Record<string, string> = { summary: "a summary", explain: "an explanation", transcript: "a transcript", book: "a study booklet", quiz: "a quiz sheet" };
  const what = WHAT[o.kind] ?? "study notes";
  return [
    `Design ONE finished page (portrait 2:3) of ${what} for a student — page ${i + 1} of ${total}. A beautiful, clear study page in the spirit of a designed infographic / study notebook.`,
    `Language and direction: Arabic, right-to-left layout (text aligned right).`,
    `Visual style: ${st.en} — ${st.idea}${design.custom ? ` The student's own style: "${design.custom.description}".` : ""} Colours: background ${c.bg}, surface ${c.paper}, text ${c.ink}, accent ${c.accent}, second accent ${c.accent2}.`,
    `Typography: clean modern Arabic lettering like "${fontById(design.fonts.heading).family}" for headings and "${fontById(design.fonts.body).family}" for text; readable sizes, high contrast, generous margins, nothing cropped. Small supporting icons or illustrations are welcome where they help, never covering text.`,
    `Write EXACTLY this Arabic text and no other words — every letter correct and properly joined, in this order:`,
    `Heading: «${p.title}»`,
    ...p.lines.map((l) => (l.startsWith("## ") ? `Sub-heading: «${l.slice(3)}»` : `Text: «${l}»`)),
    `Put the page number "${i + 1}" small at the bottom.`,
    hasRef ? "The reference image is another page of the same document: keep the same visual identity (colours, typography, decoration, margins) with this page's own text." : "",
    note ? `The student's request for this page: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function draw(o: Output, pics: Pictures, i: number, note = "") {
  const design = designOf(o);
  const ref = pics.pages.find((x, k) => k !== i && x.rendered?.path);
  const res = await openaiImage({
    model: "gpt-image-2-2026-04-21",
    prompt: prompt(o, pics.pages[i], i, pics.pages.length, design, Boolean(ref), note),
    aspect: ASPECT,
    resolution: "hi",
    quality: pics.quality,
    count: 1,
    references: ref?.rendered ? [{ bytes: await getFile(ref.rendered.path), mime: "image/png" }] : [],
    user: providerUserId(o.user_id),
  });
  const path = `${o.user_id}/${o.project_id}/pictures/${o.id}/${i + 1}-${Date.now()}.png`;
  await putFile(path, res.images[0], "image/png");
  pics.pages[i].rendered = { path, sig: sigOf(pics.pages[i], design, pics.quality) };
  return res.costUsd ?? pageUsd(pics.quality);
}

/** Pages to draw (new, changed, or never drawn) and their USD ceiling. */
export function picturesPlan(o: Output, quality: PictureQuality) {
  const old = ((o.content as { pictures?: Pictures } | null)?.pictures?.pages ?? []) as PicturePage[];
  const design = designOf(o);
  const pages = pagesOf(o).map((p, i) => {
    const prev = old[i];
    const keep = prev?.rendered && prev.rendered.sig === sigOf(p, design, quality);
    return { ...p, rendered: keep ? prev.rendered : null };
  });
  const todo = pages.filter((p) => !p.rendered).length;
  return { pages, todo, usd: todo * pageUsd(quality) };
}

async function step(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  if (!o.content) throw new UserError("الناتج غير جاهز بعد.", 409);
  const content = o.content as Record<string, unknown> & { pictures?: Pictures };
  const quality: PictureQuality = job.input.quality === "medium" ? "medium" : "high";
  const redo = Number.isInteger(job.input.page) ? Number(job.input.page) : -1;
  if (!job.progress.started) {
    content.pictures = redo >= 0 && content.pictures ? content.pictures : { quality, pages: picturesPlan(o, quality).pages };
    await saveOutput(o.id, { content });
    return { done: false, progress: { started: true }, stage: `تجهيز ${content.pictures.pages.length} صفحة` };
  }
  const pics = content.pictures!;
  if (redo >= 0 && !job.progress.redone && pics.pages[redo]) {
    const usd = await draw(o, pics, redo, String(job.input.note ?? ""));
    await saveOutput(o.id, { content });
    return { done: false, usd, progress: { started: true, redone: true }, stage: `رسم الصفحة ${redo + 1} من جديد` };
  }
  const i = redo >= 0 ? -1 : pics.pages.findIndex((p) => !p.rendered);
  if (i >= 0) {
    const usd = await draw(o, pics, i);
    await saveOutput(o.id, { content });
    const left = pics.pages.filter((p) => !p.rendered).length;
    return { done: false, usd, progress: { started: true }, stage: `رسم الصفحة ${i + 1} بـ GPT Image 2 (${pics.pages.length - left} من ${pics.pages.length})` };
  }
  // all drawn: one PDF, one page per picture
  const doc = await PDFDocument.create();
  for (const p of pics.pages) {
    const png = await doc.embedPng(await getFile(p.rendered!.path));
    const w = png.width / 2;
    const h = png.height / 2;
    doc.addPage([w, h]).drawImage(png, { x: 0, y: 0, width: w, height: h });
  }
  if (doc.getPageCount() !== pics.pages.length) throw new Error("pictures PDF incomplete");
  const path = `${o.user_id}/${o.project_id}/out/${o.id}/${Date.now()}-pictures.pdf`;
  await putFile(path, Buffer.from(await doc.save()), "application/pdf");
  await saveOutput(o.id, { files: { ...o.files, pictures_pdf: path } });
  return { done: true, stage: "الصفحات المصممة جاهزة" };
}

export const picturesHandler: Handler = {
  label: "صفحات مصممة بـ GPT Image 2",
  step,
  onFail: async (job, message) => {
    if (job.output_id) await saveOutput(job.output_id, { error: message });
  },
};
