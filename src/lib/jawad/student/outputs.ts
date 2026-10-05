// «الطالب الذكي» — making the outputs: plans, trials, final files, revisions. Server only.
// Each handler does one step per call (a chapter, a few questions, one audio part, one image, one render) and keeps
// what it made, so a stopped run continues where it was and a failed part is made again alone.

import { defaultDesign, outputName, STUDENT, type Design } from "@config/jawad/student";
import { ELEVEN_PRICE } from "@config/jawad/generators";
import { providerUserId } from "@/lib/jawad/server/providers/common";
import { elevenSpeech } from "@/lib/jawad/server/providers/elevenlabs";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { resolveVoice } from "@/lib/jawad/server/voices";
import { UserError } from "@/lib/api";
import { checkMp3, joinMp3, splitForSpeech, stripTashkeel } from "./audio";
import { askJson, claudeCeilingUsd } from "./claude";
import { allChars, allText, basedOn, levelLine, loadCtx, researchText, scopeRules, segText, understandingText, type Ctx } from "./context";
import { getFile, getOutput, joinText, putFile, saveOutput, sdb, sources, type Output } from "./db";
import type { Handler, Job, StepResult } from "./jobs";
import { BLOCK_TYPES, docText, emptyImage, type AudioPlan, type Block, type Chapter, type Doc, type DocPlan, type Question, type QuizPlan, type SlidePlan } from "./model";
import { docHtml, quizHtml, transcriptHtml } from "./render/html";
import { designFonts, fontFacesData, htmlToPdf, slidesPdf, slidesPptx } from "./render/server";

const IMAGE_MODEL = "gpt-image-2-2026-04-21";
/** Ceiling of one generated picture (gpt-image-2, 1536×1024, medium quality: $0.041 + prompt) — the real cost is settled. */
export const IMAGE_USD = 0.06;

const str = { type: "string" };
const strs = { type: "array", items: str };
const BLOCK_SCHEMA = {
  type: "object",
  properties: {
    t: { type: "string", enum: BLOCK_TYPES.filter((t) => t !== "image") },
    text: str,
    title: str,
    items: { type: "array", items: { type: "object", properties: { title: str, text: str }, required: ["title", "text"], additionalProperties: false } },
    rows: { type: "array", items: strs },
    sources: { type: "array", items: { type: "integer" } },
    segments: strs,
  },
  required: ["t", "text", "title", "items", "rows", "sources", "segments"],
  additionalProperties: false,
};
const BLOCKS_SCHEMA = { type: "object", properties: { blocks: { type: "array", items: BLOCK_SCHEMA } }, required: ["blocks"], additionalProperties: false };

const BLOCK_GUIDE = `Blocks (field "t"): h = sub-heading (text) · p = paragraph (text; **bold** and ==highlight== allowed sparingly) · list = bullet list (items[].text, optional items[].title) · note = a short margin note / tip · term = a term (title) and its definition (text) · quote = exact words from the material (text) and where (title) · addition = your own addition (only if allowed) · research = from the research (text + sources) · cards = parallel units (items: title + text) · steps = ordered steps (items) · compare = a table (rows[0] is the header row) · question = a review question · scene = a short scene / case (title + text).
Unused fields: empty string / empty array.`;

const DENSITY: Record<string, string> = {
  high: "very detailed: keep every idea, explain fully, many examples from the material",
  medium: "balanced: the main ideas with enough explanation",
  low: "few words: the essentials only, short sentences",
};

const designOf = (o: Output): Design => (o.settings.design as Design) ?? defaultDesign(o.kind === "book" ? "notebook" : "editorial");

// ───────────────────────────── estimates (USD ceilings, shown as coins before the student confirms) ─────────────────────────────

export async function estimate(userId: string, o: Output, action: string, chapter = -1): Promise<number> {
  if (o.kind === "transcript") return 0;
  const c = await loadCtx(userId, o.project_id);
  const chars = allChars(c) + (c.research ? 20_000 : 0);
  if (action === "plan") {
    if (o.kind === "book" && o.settings.writing === "verbatim") return 0;
    if (o.kind === "audio") {
      // the reading text comes back whole (with diacritics): output tokens up to its length
      const n = audioSourceText(c, o, await depDoc(o)).length;
      return claudeCeilingUsd(n, n) + Math.ceil(n / 6000) * claudeCeilingUsd(0, 0);
    }
    return claudeCeilingUsd(Math.min(chars, 400_000), 16000);
  }
  const plan = o.plan as DocPlan | SlidePlan | QuizPlan | AudioPlan | null;
  const imgs = (list: { image: { mode: string; path: string } }[], only?: number) =>
    list.slice(0, only ?? list.length).filter((x) => x.image.mode === "generate" && !x.image.path).length * IMAGE_USD;
  if (o.kind === "slides") {
    const p = plan as SlidePlan;
    return action === "trial" ? imgs(p.slides, 3) : imgs(p.slides);
  }
  if (o.kind === "audio") {
    const p = plan as AudioPlan;
    const n = p.files.reduce((s, f) => s + f.text.length, 0);
    return (n / 1000) * ELEVEN_PRICE.v4PerKChars * 1.02 + 0.01;
  }
  if (o.kind === "quiz") return claudeCeilingUsd(Math.min(chars, 300_000), 12000) * Math.max(1, (plan as QuizPlan).rows.length);
  // summary / explain / book
  const p = plan as DocPlan;
  const verbatim = o.kind === "book" && o.settings.writing === "verbatim";
  const chapterUsd = (i: number) => (verbatim ? 0 : claudeCeilingUsd(segChars(c, p.chapters[i].segments) + (c.research ? 15_000 : 0) + 4000, 14000));
  if (action === "trial") return chapterUsd(0) + imgs(p.chapters, 1);
  if (action === "revise") {
    return chapter >= 0 && chapter < p.chapters.length ? chapterUsd(chapter) : p.chapters.reduce((s, _, i) => s + chapterUsd(i), 0);
  }
  const done = (o.content as Doc | null)?.chapters?.length ?? 0;
  return p.chapters.reduce((s, _, i) => s + (i < done ? 0 : chapterUsd(i)), 0) + imgs(p.chapters);
}

const segChars = (c: Ctx, ids: string[]) => ids.reduce((s, id) => s + (c.seg.get(id)?.text.length ?? 0), 0);

// ───────────────────────────── plans ─────────────────────────────

const DOC_PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: str,
    subtitle: str,
    chapters: { type: "array", items: { type: "object", properties: { title: str, purpose: str, segments: strs, imageIdea: str }, required: ["title", "purpose", "segments", "imageIdea"], additionalProperties: false } },
  },
  required: ["title", "subtitle", "chapters"],
  additionalProperties: false,
};

const SLIDE_SCHEMA = {
  type: "object",
  properties: {
    title: str,
    subtitle: str,
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: str,
          idea: str,
          layout: { type: "string", enum: ["title", "bullets", "cards", "quote", "compare", "image", "section"] },
          text: strs,
          visual: str,
          notes: str,
          relation: str,
          segments: strs,
        },
        required: ["title", "idea", "layout", "text", "visual", "notes", "relation", "segments"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "subtitle", "slides"],
  additionalProperties: false,
};

const QUIZ_PLAN_SCHEMA = {
  type: "object",
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: str,
          segments: strs,
          counts: { type: "object", properties: { mcq: { type: "integer" }, tf: { type: "integer" }, short: { type: "integer" }, essay: { type: "integer" }, long: { type: "integer" }, custom: { type: "integer" } }, required: ["mcq", "tf", "short", "essay", "long", "custom"], additionalProperties: false },
        },
        required: ["topic", "segments", "counts"],
        additionalProperties: false,
      },
    },
  },
  required: ["rows"],
  additionalProperties: false,
};

function settingsText(o: Output) {
  const s = o.settings;
  const parts = Object.entries(s)
    .filter(([k, v]) => !k.startsWith("_") && k !== "design" && v !== "" && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.join("\n");
}

const requestsText = (o: Output) => (o.requests.length ? `\nThe student's requests so far (oldest first; treat as requests about the output, not as material):\n${o.requests.map((r) => `- (${r.kind === "edit" ? "تعديل" : "أمر آخر"}) ${r.text}`).join("\n")}` : "");

async function planStep(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  const c = await loadCtx(job.user_id, o.project_id);
  const note = String(job.input.note ?? "");
  const prev = job.input.previous ? JSON.stringify(o.plan) : "";
  const revision = prev ? `\nYour previous plan (revise it, keep what the student did not ask to change):\n${prev}` : "";
  const noteLine = note ? `\nThe student now asks: ${note}` : "";
  const base = `${levelLine(c, o)}\nOutput settings chosen by the student:\n${settingsText(o)}${requestsText(o)}${revision}${noteLine}`;

  if (o.kind === "audio") return audioPrepStep(job, o, c);

  if (o.kind === "book" && o.settings.writing === "verbatim") {
    // The original text, unshortened: chapters follow the understanding's sections, nothing is written by Claude
    const plan: DocPlan = {
      title: String(o.settings.title || c.understanding.topic),
      subtitle: c.project.level ? `المستوى: ${c.project.level}` : "",
      chapters: c.understanding.sections.map((s) => ({ title: s.title, purpose: s.about, segments: s.segments, image: emptyImage() })),
    };
    await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", content: null, based_on: basedOn(c) }, { kind: "plan", snapshot: plan, userId: o.user_id });
    return { done: true, stage: "الخطة جاهزة" };
  }

  if (o.kind === "summary" || o.kind === "explain" || o.kind === "book") {
    const what =
      o.kind === "summary"
        ? "a SUMMARY: keep the essential ideas and the source's structure (no claim of covering every word)"
        : o.kind === "explain"
          ? "a NEW EXPLANATION: re-present the concepts in language suited to the level, unpack the terms"
          : `a READING BOOK / BOOKLET (${o.settings.writing === "summary" ? "a summary book" : "an explanatory book"})`;
    const r = await askJson<{ title: string; subtitle: string; chapters: { title: string; purpose: string; segments: string[]; imageIdea: string }[] }>({
      system: `You plan ${what} of the student's material, in Arabic. Return a title, a subtitle and ordered chapters; each chapter says what it will cover (purpose) and lists the ids of ALL material segments it draws on. Every segment of the material must be used by some chapter unless the settings say to leave something out. imageIdea: a short idea for an illustrative visual (or empty if none fits). Density: ${DENSITY[String(o.settings.density ?? o.settings.detail ?? "medium")] ?? DENSITY.medium}.\n${scopeRules(c)}`,
      parts: [{ type: "text", text: `${base}\n\nUNDERSTANDING:\n${understandingText(c)}\n\nMATERIAL:\n${allText(c)}\n${researchText(c)}` }],
      schema: DOC_PLAN_SCHEMA,
    });
    const valid = new Set(c.seg.keys());
    const plan: DocPlan = {
      title: r.data.title,
      subtitle: r.data.subtitle,
      chapters: r.data.chapters.map((ch) => ({ title: ch.title, purpose: ch.purpose, segments: ch.segments.filter((x) => valid.has(x)), image: { ...emptyImage(), prompt: ch.imageIdea } })),
    };
    await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", content: null, based_on: basedOn(c) }, { kind: "plan", snapshot: plan, userId: o.user_id });
    return { done: true, usd: r.usd, stage: "الخطة جاهزة" };
  }

  if (o.kind === "slides") {
    const s = o.settings;
    const notes = s.notesMode === "notes" ? "Keep the slide text short and put the explanation in the speaker notes." : s.notesMode === "both" ? "Text on the slide and a fuller explanation in the speaker notes." : "Put the explanation on the slides; speaker notes may stay short.";
    const r = await askJson<SlidePlan & { slides: (SlidePlan["slides"][number] & { visual: string })[] }>({
      system: `You write the complete SLIDE MAP of a presentation from the student's material, in Arabic. For every slide: title, the idea, the layout (title = opening slide, section = a part divider, bullets, cards = 2–6 parallel units written "label: text", compare = a table written as rows "cell | cell | cell" with the header row first, quote = exact words from the material, image = a visual with a few points), the final text lines of the slide, the proposed visual, speaker notes, and how it relates to the slides before and after. Slide count: ${Number(s.count) > 0 ? `about ${Number(s.count)}` : "as the material needs"}. Density: ${DENSITY[String(s.density ?? "medium")] ?? DENSITY.medium} — when there is more to say, use MORE slides, never more words per slide than fit (at most ~7 lines). ${notes}\n${scopeRules(c)}\nAdditions and research go on their own slides or lines that say so ("إضافة:" / "من البحث:").`,
      parts: [{ type: "text", text: `${base}\n\nUNDERSTANDING:\n${understandingText(c)}\n\nMATERIAL:\n${allText(c)}\n${researchText(c)}` }],
      schema: SLIDE_SCHEMA,
    });
    const valid = new Set(c.seg.keys());
    const plan: SlidePlan = { title: r.data.title, subtitle: r.data.subtitle, slides: r.data.slides.map((sl) => ({ ...sl, segments: sl.segments.filter((x) => valid.has(x)), image: { ...emptyImage(), prompt: sl.visual } })) };
    await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", content: null, files: {}, based_on: basedOn(c) }, { kind: "plan", snapshot: plan, userId: o.user_id });
    return { done: true, usd: r.usd, stage: "خريطة الشرائح جاهزة" };
  }

  if (o.kind === "quiz") {
    const s = o.settings;
    const types = (s.types as string[]) ?? ["mcq"];
    const r = await askJson<QuizPlan>({
      system: `You plan a QUIZ on the student's material: distribute exactly ${Number(s.count) || 10} questions over the material's topics and the question types the student chose (${types.join(", ")}${s.customType ? `; "custom" = ${String(s.customType)}` : ""}). Use only the chosen types (others 0). Difficulty: ${String(s.difficulty ?? "medium")}${s.difficultyNote ? ` (${String(s.difficultyNote)})` : ""}. Each row: a topic (in Arabic) from the material, the segment ids it covers, and the count per type. ${c.project.allow_additions ? "Questions may go slightly beyond the material where additions are allowed." : "Only topics the material covers."}`,
      parts: [{ type: "text", text: `${base}\n\nUNDERSTANDING:\n${understandingText(c)}` }],
      schema: QUIZ_PLAN_SCHEMA,
      maxTokens: 8000,
    });
    await saveOutput(o.id, { plan: r.data, plan_approved: false, status: "plan_review", content: null, files: {}, based_on: basedOn(c) }, { kind: "plan", snapshot: r.data, userId: o.user_id });
    return { done: true, usd: r.usd, stage: "توزيع الأسئلة جاهز" };
  }
  throw new Error(`no plan for ${o.kind}`);
}

// ───────────────────────────── audio: the reading text (with any added tashkeel) ─────────────────────────────

async function depDoc(o: Output): Promise<Doc | null> {
  const src = String(o.settings.source ?? "text");
  if (src === "text" || src === "custom") return null;
  const { data } = await sdb().from("student_outputs").select("content,status,kind").eq("id", src).maybeSingle();
  return data && data.status === "done" ? (data.content as Doc) : null;
}

function audioFiles(c: Ctx, o: Output, doc: Doc | null): { title: string; original: string }[] {
  const multi = o.settings.mode === "multi";
  const src = String(o.settings.source ?? "text");
  if (src === "custom") return [{ title: "التسجيل", original: String(o.settings.customText ?? "") }];
  if (doc) {
    const per = doc.chapters.map((ch) => ({ title: ch.title, original: docText({ title: ch.title, subtitle: "", chapters: [{ title: "", blocks: ch.blocks }] }) }));
    return multi ? per : [{ title: doc.title, original: per.map((p) => p.original).join("\n\n") }];
  }
  const per = c.understanding.sections.map((s) => ({ title: s.title, original: s.segments.map((id) => c.seg.get(id)?.text ?? "").join("\n\n") }));
  return multi ? per : [{ title: c.understanding.topic, original: joinText(c.text, false) }];
}
const audioSourceText = (c: Ctx, o: Output, doc: Doc | null) => audioFiles(c, o, doc).map((f) => f.original).join("\n\n");

const TASHKEEL = `You prepare an Arabic text to be read aloud by a speech engine. Return the SAME text, character for character, adding tashkeel (diacritics) only where it is needed for a correct reading: ambiguous words, names, terms, and case endings where they change the meaning. Do not add, remove, reorder or replace any letter, word, number or punctuation mark, and do not change any existing diacritic. If the text is not Arabic, return it unchanged.`;

async function audioPrepStep(job: Job, o: Output, c: Ctx): Promise<StepResult> {
  const doc = await depDoc(o);
  if (String(o.settings.source ?? "text") !== "text" && String(o.settings.source) !== "custom" && !doc) throw new UserError("النص المختار للقراءة لم يُعتمد بعد.", 409);
  const files = audioFiles(c, o, doc);
  const prog = job.progress as { file?: number; piece?: number; out?: string[] };
  const fi = prog.file ?? 0;
  const out = prog.out ?? [];
  if (fi >= files.length) {
    const plan: AudioPlan = { files: files.map((f, i) => ({ title: f.title, original: f.original, text: out[i] ?? f.original })) };
    await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", files: {}, based_on: { ...basedOn(c), dependency: doc ? String(o.settings.source) : undefined } }, { kind: "plan", snapshot: plan, userId: o.user_id });
    return { done: true, stage: "نص القراءة جاهز للمراجعة" };
  }
  // one file, a piece of ~6000 characters at a time (cut at paragraph ends)
  const pieces = splitForSpeech(files[fi].original, 6000);
  const pi = prog.piece ?? 0;
  if (pi >= pieces.length) return { done: false, progress: { file: fi + 1, piece: 0, out }, stage: `تجهيز نص القراءة: ${fi + 1} من ${files.length}` };
  const piece = pieces[pi];
  const r = await askJson<{ text: string }>({ system: TASHKEEL, parts: [{ type: "text", text: piece }], schema: { type: "object", properties: { text: str }, required: ["text"], additionalProperties: false }, maxTokens: 16000, effort: "low" });
  // Only diacritics may change: anything else and this piece keeps the original
  const same = stripTashkeel(r.data.text).replace(/\s+/g, " ").trim() === stripTashkeel(piece).replace(/\s+/g, " ").trim();
  out[fi] = `${out[fi] ? `${out[fi]}\n\n` : ""}${same ? r.data.text.trim() : piece}`;
  return { done: false, usd: r.usd, progress: { file: fi, piece: pi + 1, out }, stage: `تجهيز نص القراءة (التشكيل): الملف ${fi + 1} من ${files.length}، الجزء ${pi + 1} من ${pieces.length}` };
}

// ───────────────────────────── writing chapters ─────────────────────────────

async function writeChapter(c: Ctx, o: Output, plan: DocPlan, i: number, revise?: { note: string; current: Chapter; kind: string }) {
  const ch = plan.chapters[i];
  if (o.kind === "book" && o.settings.writing === "verbatim" && !revise) {
    // The approved text as is: headings marked "# " become headings, the rest paragraphs. Nothing dropped.
    const blocks: Block[] = [];
    for (const id of ch.segments) {
      const s = c.seg.get(id);
      if (!s) continue;
      for (const para of s.text.split(/\n{2,}/)) {
        const t = para.trim();
        if (!t) continue;
        const h = /^#{1,3}\s+/.test(t);
        blocks.push({ t: h ? "h" : "p", text: h ? t.replace(/^#{1,3}\s+/, "") : t, title: "", items: [], rows: [], sources: [], segments: [id] });
      }
    }
    return { chapter: { title: ch.title, blocks }, usd: 0 };
  }
  const kind = o.kind === "summary" ? "a summary chapter" : o.kind === "explain" ? "an explanation chapter (simpler, terms unpacked, examples from the material)" : `a chapter of a reading book (${o.settings.writing === "summary" ? "summary book" : "explanatory book"})`;
  const r = await askJson<{ blocks: Block[] }>({
    system: `You write ${kind} in Arabic for the student, as blocks. ${BLOCK_GUIDE}\nDensity: ${DENSITY[String(o.settings.density ?? o.settings.detail ?? "medium")] ?? DENSITY.medium}. Vary the blocks where it helps understanding (terms, cards for parallel ideas, steps, a comparison table, a margin note, a review question), but most of the content is paragraphs and lists.\n${scopeRules(c)}`,
    parts: [
      {
        type: "text",
        text: `${levelLine(c, o)}\nSettings:\n${settingsText(o)}${requestsText(o)}\n\nBook / document: ${plan.title}\nThis chapter (${i + 1} of ${plan.chapters.length}): ${ch.title}\nWhat it covers: ${ch.purpose}\nOther chapters: ${plan.chapters.map((x) => x.title).join(" · ")}\n${
          revise ? `\nCURRENT VERSION of this chapter (revise it — change only what the request needs, keep the rest):\n${JSON.stringify(revise.current.blocks)}\nThe student's ${revise.kind === "other" ? "new requirement" : "edit request"}: ${revise.note}\n` : ""
        }\nMATERIAL FOR THIS CHAPTER:\n${segText(c, ch.segments)}\n${researchText(c)}`,
      },
    ],
    schema: BLOCKS_SCHEMA,
  });
  const valid = new Set(c.seg.keys());
  const blocks = r.data.blocks
    .filter((b) => (b.t !== "addition" || c.project.allow_additions) && (b.t !== "research" || c.research))
    .map((b) => ({ ...b, segments: b.segments.filter((x) => valid.has(x)), sources: b.t === "research" ? b.sources.filter((n) => n >= 0 && n < (c.research?.sources.length ?? 0)) : [] }));
  return { chapter: { title: ch.title, blocks }, usd: r.usd };
}

// ───────────────────────────── images ─────────────────────────────

async function makeImage(o: Output, c: Ctx, prompt: string, n: number) {
  const res = await openaiImage({
    model: IMAGE_MODEL,
    prompt: `An illustration for a study ${o.kind === "slides" ? "presentation slide" : "book"} (level: ${c.project.level || "general"}). ${prompt}. No text or letters in the picture. It is illustrative, not documentary.`,
    aspect: "3:2",
    resolution: "std",
    quality: "medium",
    count: 1,
    references: [],
    user: providerUserId(o.user_id),
  });
  const path = `${o.user_id}/${o.project_id}/img/${o.id}-${n}-${Date.now()}.png`;
  await putFile(path, res.images[0], "image/png");
  return { path, usd: res.costUsd ?? IMAGE_USD };
}

/** The next picture still to make or pick, or null. Returns what changed. */
async function nextImage(o: Output, c: Ctx, items: { image: { mode: string; prompt: string; sourceId: string; path: string } }[], limit?: number) {
  const list = items.slice(0, limit ?? items.length);
  const k = list.findIndex((x) => x.image.mode !== "none" && !x.image.path);
  if (k < 0) return null;
  const img = list[k].image;
  if (img.mode === "own") {
    const src = (await sources(o.project_id)).find((s) => s.id === img.sourceId && s.kind === "image");
    img.path = src?.path ?? "";
    if (!img.path) img.mode = "none";
    return { k, usd: 0 };
  }
  const r = await makeImage(o, c, img.prompt, k);
  img.path = r.path;
  return { k, usd: r.usd };
}

async function imageData(paths: string[]) {
  const out: Record<string, string> = {};
  const raw: Record<string, Buffer> = {};
  for (const p of [...new Set(paths.filter(Boolean))]) {
    const b = await getFile(p);
    raw[p] = b;
    out[p] = `data:image/${p.endsWith(".png") ? "png" : "jpeg"};base64,${b.toString("base64")}`;
  }
  return { out, raw };
}

// ───────────────────────────── rendering ─────────────────────────────

const filePath = (o: Output, name: string) => `${o.user_id}/${o.project_id}/out/${o.id}/${Date.now()}-${name}`;

async function renderDoc(o: Output, c: Ctx, doc: Doc, plan: DocPlan, trial: boolean) {
  const design = designOf(o);
  // pictures go at the start of their chapter
  const withImages: Doc = {
    ...doc,
    chapters: doc.chapters.map((ch, i) => {
      const img = plan.chapters[i]?.image;
      return img?.path ? { ...ch, blocks: [{ t: "image", title: img.path, text: img.mode === "generate" ? "صورة توضيحية (ليست توثيقًا)" : "", items: [], rows: [], sources: [], segments: [] } as Block, ...ch.blocks] } : ch;
    }),
  };
  const { out } = await imageData(plan.chapters.map((ch) => ch.image.path));
  const html = docHtml(withImages, design, {
    fontFaces: await fontFacesData(designFonts(design)),
    images: out,
    sources: c.research?.sources ?? [],
    page: o.settings.page === "A5" ? "A5" : "A4",
    trial,
  });
  const { pdf } = await htmlToPdf(html, { numbered: o.settings.numbered !== false });
  const path = filePath(o, trial ? "trial.pdf" : "book.pdf");
  await putFile(path, pdf, "application/pdf");
  return path;
}

async function renderSlides(o: Output, plan: SlidePlan, only?: number[]) {
  const design = designOf(o);
  const aspect = o.settings.aspect === "4:3" ? "4:3" : "16:9";
  const { out, raw } = await imageData(plan.slides.map((s) => s.image.path));
  const fontFaces = await fontFacesData(designFonts(design));
  const { pdf, fit } = await slidesPdf(plan, design, { fontFaces, images: out, aspect, only, trial: Boolean(only) });
  const pptx = await slidesPptx(plan, design, { aspect, fit, images: raw, only });
  const tag = only ? "trial" : "slides";
  const pdfPath = filePath(o, `${tag}.pdf`);
  const pptxPath = filePath(o, `${tag}.pptx`);
  await putFile(pdfPath, pdf, "application/pdf");
  await putFile(pptxPath, pptx, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  return { pdfPath, pptxPath, overflow: fit.filter((f) => f[2]).map((f) => f[0] + 1) };
}

// ───────────────────────────── trial ─────────────────────────────

async function trialStep(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  const c = await loadCtx(job.user_id, o.project_id);
  if (o.kind === "slides") {
    const plan = o.plan as SlidePlan;
    const img = await nextImage(o, c, plan.slides, 3);
    if (img) {
      await saveOutput(o.id, { plan });
      return { done: false, usd: img.usd, stage: `صورة الشريحة ${img.k + 1}` };
    }
    const r = await renderSlides(o, plan, [0, 1, 2].filter((i) => i < plan.slides.length));
    await saveOutput(o.id, { status: "trial_review", trial: { overflow: r.overflow }, files: { ...o.files, trial_pdf: r.pdfPath, trial_pptx: r.pptxPath } }, { kind: "trial", snapshot: { files: [r.pdfPath, r.pptxPath] }, userId: o.user_id });
    return { done: true, stage: "النسخة التجريبية جاهزة" };
  }
  // book: the first chapter written (kept for the final version) and printed as a sample
  const plan = o.plan as DocPlan;
  const doc = (o.content as Doc | null) ?? { title: plan.title, subtitle: plan.subtitle, chapters: [] };
  if (!doc.chapters[0]) {
    const r = await writeChapter(c, o, plan, 0);
    doc.chapters[0] = r.chapter;
    await saveOutput(o.id, { content: doc });
    return { done: false, usd: r.usd, stage: "كتابة الفصل الأول للنسخة التجريبية" };
  }
  const img = await nextImage(o, c, plan.chapters, 1);
  if (img) {
    await saveOutput(o.id, { plan });
    return { done: false, usd: img.usd, stage: "صورة الفصل الأول" };
  }
  const sample: Doc = { ...doc, chapters: [{ ...doc.chapters[0], blocks: doc.chapters[0].blocks.slice(0, 10) }] };
  const path = await renderDoc(o, c, sample, { ...plan, chapters: plan.chapters.slice(0, 1) }, true);
  await saveOutput(o.id, { status: "trial_review", files: { ...o.files, trial_pdf: path } }, { kind: "trial", snapshot: { files: [path] }, userId: o.user_id });
  return { done: true, stage: "النسخة التجريبية جاهزة" };
}

// ───────────────────────────── final + revisions ─────────────────────────────

const QUESTIONS_SCHEMA = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: { type: str, question: str, options: strs, answer: str, explanation: str, segments: strs },
        required: ["type", "question", "options", "answer", "explanation", "segments"],
        additionalProperties: false,
      },
    },
  },
  required: ["questions"],
  additionalProperties: false,
};

async function quizStep(job: Job, o: Output, c: Ctx): Promise<StepResult> {
  const plan = o.plan as QuizPlan;
  const content = (o.content as { questions: Question[]; rowsDone: number } | null) ?? { questions: [], rowsDone: 0 };
  const revising = job.kind === "revise";
  if (revising && !job.progress.reset) {
    await saveOutput(o.id, { content: { questions: [], rowsDone: 0 } });
    return { done: false, progress: { reset: true }, stage: "إعادة إنشاء الأسئلة" };
  }
  if (content.rowsDone < plan.rows.length) {
    const row = plan.rows[content.rowsDone];
    const wanted = Object.entries(row.counts).filter(([, n]) => n > 0);
    const s = o.settings;
    const r = await askJson<{ questions: Question[] }>({
      system: `You write quiz questions in Arabic from the student's material. Write exactly: ${wanted.map(([t, n]) => `${n} × ${t}`).join(", ")} (types: mcq = multiple choice with 4 options, tf = true/false with options ["صح","خطأ"], short = short answer, essay = essay, long = long answer${s.customType ? `, custom = ${String(s.customType)}` : ""}). Difficulty: ${String(s.difficulty ?? "medium")}${s.difficultyNote ? ` (${String(s.difficultyNote)})` : ""}. Every question has the correct answer and an explanation that points to the material, and lists the segment ids it is based on. ${c.project.allow_additions ? "You may go slightly beyond the material (additions allowed)." : "Ask only about what the material says."} No two questions ask the same thing.${requestsText(o)}`,
      parts: [{ type: "text", text: `Topic: ${row.topic}\nAlready asked (do not repeat): ${content.questions.map((q) => q.question).join(" | ") || "none"}\n\nMATERIAL:\n${segText(c, row.segments.length ? row.segments : [...c.seg.keys()])}\n${researchText(c)}` }],
      schema: QUESTIONS_SCHEMA,
      maxTokens: 12000,
    });
    const valid = new Set(c.seg.keys());
    content.questions.push(...r.data.questions.map((q) => ({ ...q, segments: q.segments.filter((x) => valid.has(x)) })));
    content.rowsDone++;
    await saveOutput(o.id, { content });
    return { done: false, usd: r.usd, stage: `كتابة الأسئلة: ${content.rowsDone} من ${plan.rows.length}` };
  }
  const usage = String(o.settings.usage ?? "both");
  const files: Record<string, string> = {};
  if (usage !== "interactive") {
    const design = designOf(o);
    const fontFaces = await fontFacesData(designFonts(design));
    const title = String(o.settings.title || `اختبار: ${c.understanding.topic}`);
    const q = await htmlToPdf(quizHtml(title, content.questions, design, { fontFaces, answers: false }), { numbered: true });
    const a = await htmlToPdf(quizHtml(title, content.questions, design, { fontFaces, answers: true }), { numbered: true });
    files.quiz_pdf = filePath(o, "quiz.pdf");
    files.answers_pdf = filePath(o, "answers.pdf");
    await putFile(files.quiz_pdf, q.pdf, "application/pdf");
    await putFile(files.answers_pdf, a.pdf, "application/pdf");
  }
  await saveOutput(o.id, { status: "review", files }, { kind: "final", snapshot: content, userId: o.user_id });
  return { done: true, stage: "الاختبار جاهز" };
}

async function audioStep(job: Job, o: Output): Promise<StepResult> {
  const plan = o.plan as AudioPlan;
  const run = Number(job.input.run) || 1;
  const db = sdb();
  const { data: rows } = await db.from("student_audio_parts").select("*").eq("output_id", o.id).eq("run", run).order("idx");
  let parts = (rows ?? []) as { id: string; idx: number; file_idx: number; text: string; status: string; path: string | null; attempts: number }[];
  if (!parts.length) {
    const ins = plan.files.flatMap((f, fi) => splitForSpeech(f.text, STUDENT.audioPartChars).map((t) => ({ text: t, file_idx: fi + 1 })));
    const { error } = await db.from("student_audio_parts").upsert(
      ins.map((p, i) => ({ output_id: o.id, user_id: o.user_id, run, idx: i + 1, file_idx: p.file_idx, text: p.text })),
      { onConflict: "output_id,run,idx", ignoreDuplicates: true },
    );
    if (error) throw error;
    return { done: false, stage: `تقسيم النص إلى ${ins.length} مقطع`, progress: { parts: ins.length, done: 0 } };
  }
  if (job.input.retry && !job.progress.reset) {
    await db.from("student_audio_parts").update({ status: "pending", attempts: 0, error: null }).eq("output_id", o.id).eq("run", run).eq("status", "failed");
    return { done: false, progress: { reset: true }, stage: "إعادة المقاطع المتعثرة" };
  }
  const next = parts.find((p) => p.status === "pending");
  if (next) {
    const voice = await resolveVoice(o.user_id, String(o.settings.voice ?? "p:JBFqnCBsd6RMkjVDRZzb"));
    if (!voice.ok) throw new UserError(voice.reason, 400);
    try {
      const mp3 = await elevenSpeech({ voiceId: voice.voiceId, text: next.text, model: "eleven_v4", languageCode: "ar" });
      const check = checkMp3(mp3);
      if (!check.ok) throw new Error("audio part failed the MP3 check");
      const path = `${o.user_id}/${o.project_id}/audio/${o.id}/r${run}-${String(next.idx).padStart(4, "0")}.mp3`;
      await putFile(path, mp3, "audio/mpeg");
      await db.from("student_audio_parts").update({ status: "done", path, bytes: mp3.length, seconds: check.seconds, attempts: next.attempts + 1, error: null }).eq("id", next.id);
      const doneN = parts.filter((p) => p.status === "done").length + 1;
      return { done: false, usd: (next.text.length / 1000) * ELEVEN_PRICE.v4PerKChars, stage: `توليد الصوت: المقطع ${next.idx} من ${parts.length}`, progress: { parts: parts.length, done: doneN } };
    } catch (e) {
      // the part is tried up to 3 times; the parts already made are kept and never made (or charged) again
      const attempts = next.attempts + 1;
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("student_audio_parts").update({ status: attempts >= 3 ? "failed" : "pending", attempts, error: msg.slice(0, 300) }).eq("id", next.id);
      return { done: false, stage: `تعثّر المقطع ${next.idx} (محاولة ${attempts} من 3)` };
    }
  }
  // all parts tried: join each file whose parts all succeeded
  parts = ((await db.from("student_audio_parts").select("*").eq("output_id", o.id).eq("run", run).order("idx")).data ?? []) as typeof parts;
  const files: Record<string, string> = {};
  const info: { title: string; seconds: number; complete: boolean }[] = [];
  for (let fi = 1; fi <= plan.files.length; fi++) {
    const mine = parts.filter((p) => p.file_idx === fi);
    const complete = mine.length > 0 && mine.every((p) => p.status === "done");
    let seconds = 0;
    if (complete) {
      const joined = joinMp3(await Promise.all(mine.map((p) => getFile(p.path!))));
      const check = checkMp3(joined);
      if (!check.ok) throw new Error("joined MP3 failed the check");
      seconds = check.seconds;
      const path = `${o.user_id}/${o.project_id}/audio/${o.id}/r${run}-file${fi}.mp3`;
      await putFile(path, joined, "audio/mpeg");
      files[`audio_${fi}`] = path;
    }
    info.push({ title: plan.files[fi - 1].title, seconds, complete });
  }
  const failed = parts.filter((p) => p.status === "failed").length;
  await saveOutput(o.id, { status: "review", files, content: { run, files: info, failedParts: failed } }, { kind: "final", snapshot: { run, files: info, failed }, userId: o.user_id });
  return { done: true, stage: failed ? `اكتمل مع ${failed} مقطع متعثر` : "التسجيل جاهز" };
}

async function finalStep(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  if (o.kind === "transcript") return transcriptStep(o);
  const c = await loadCtx(job.user_id, o.project_id);
  if (o.kind === "quiz") return quizStep(job, o, c);
  if (o.kind === "audio") return audioStep(job, o);
  if (o.kind === "slides") {
    const plan = o.plan as SlidePlan;
    const img = await nextImage(o, c, plan.slides);
    if (img) {
      await saveOutput(o.id, { plan });
      return { done: false, usd: img.usd, stage: `صورة الشريحة ${img.k + 1}` };
    }
    const r = await renderSlides(o, plan);
    await saveOutput(o.id, { status: "review", content: { overflow: r.overflow }, files: { ...o.files, pdf: r.pdfPath, pptx: r.pptxPath } }, { kind: "final", snapshot: { plan, files: [r.pdfPath, r.pptxPath] }, userId: o.user_id });
    return { done: true, stage: "العرض جاهز" };
  }
  // summary / explain / book
  const plan = o.plan as DocPlan;
  const doc = (o.content as Doc | null) ?? { title: plan.title, subtitle: plan.subtitle, chapters: [] };
  const revise = job.kind === "revise" ? { note: String(job.input.note ?? ""), chapter: Number(job.input.chapter ?? -1), kind: String(job.input.requestKind ?? "edit") } : null;
  const todo = revise
    ? (revise.chapter >= 0 ? [revise.chapter] : plan.chapters.map((_, i) => i)).filter((i) => !((job.progress.revised as number[] | undefined) ?? []).includes(i))
    : plan.chapters.map((_, i) => i).filter((i) => !doc.chapters[i]);
  if (todo.length) {
    const i = todo[0];
    const r = await writeChapter(c, o, plan, i, revise && doc.chapters[i] ? { note: revise.note, current: doc.chapters[i], kind: revise.kind } : undefined);
    doc.chapters[i] = r.chapter;
    await saveOutput(o.id, { content: doc });
    const revised = [...((job.progress.revised as number[] | undefined) ?? []), i];
    return { done: false, usd: r.usd, stage: `${revise ? "تعديل" : "كتابة"} الفصل ${i + 1} من ${plan.chapters.length}`, progress: { revised } };
  }
  if (o.kind === "book") {
    const img = await nextImage(o, c, plan.chapters);
    if (img) {
      await saveOutput(o.id, { plan });
      return { done: false, usd: img.usd, stage: `صورة الفصل ${img.k + 1}` };
    }
  }
  const path = await renderDoc(o, c, doc, plan, false);
  await saveOutput(o.id, { status: "review", files: { ...o.files, pdf: path } }, { kind: revise ? "revision" : "final", snapshot: doc, userId: o.user_id });
  return { done: true, stage: `${outputName(o.kind)} جاهز` };
}

async function transcriptStep(o: Output): Promise<StepResult> {
  const content = o.content as { title: string; segments: { label: string; raw: string; text: string }[] };
  const fontFaces = await fontFacesData(["readex", "amiri"]);
  const { pdf } = await htmlToPdf(transcriptHtml(content.title, content.segments, { fontFaces }), { numbered: true });
  const pdfPath = filePath(o, "transcript.pdf");
  const txtPath = filePath(o, "transcript.txt");
  await putFile(pdfPath, pdf, "application/pdf");
  await putFile(txtPath, content.segments.map((s) => `[${s.label}]\n${s.text}`).join("\n\n"), "text/plain; charset=utf-8");
  await saveOutput(o.id, { status: "review", files: { pdf: pdfPath, txt: txtPath } });
  return { done: true, stage: "التفريغ جاهز" };
}

// ───────────────────────────── the student's own style ─────────────────────────────

async function styleStep(job: Job): Promise<StepResult> {
  const o = await getOutput(job.user_id, job.output_id!);
  const description = String(job.input.description ?? "");
  const hexS = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
  type Tokens = { colors: NonNullable<Design["custom"]>["colors"]; texture: "none" | "paper" | "lines" | "grid"; radius: number; base: string; heading: string; body: string; accent: string; notes: string };
  const r = await askJson<Tokens>({
    system: `A student described the visual style they want for a study ${o.kind === "slides" ? "presentation" : "book"}. Turn it into concrete design tokens: colours (bg = page background, paper = content surface, ink = text, muted = secondary text, accent, accent2, line = borders; text must keep strong contrast with paper), a texture, a corner radius (0–24 px), the closest layout base among notebook / editorial / bento / cinematic / collage, fonts for heading / body / accent chosen ONLY from these ids: readex, plex, amiri, scheherazade, markazi, messiri, reemkufi, tajawal, playpen, lalezar, baloo (body must be readable for long text), and notes in Arabic explaining how you understood their description (density, imagery, distribution). Do not replace their description with a stock style.`,
    parts: [{ type: "text", text: description }],
    schema: {
      type: "object",
      properties: {
        colors: { type: "object", properties: { bg: hexS, paper: hexS, ink: hexS, muted: hexS, accent: hexS, accent2: hexS, line: hexS }, required: ["bg", "paper", "ink", "muted", "accent", "accent2", "line"], additionalProperties: false },
        texture: { type: "string", enum: ["none", "paper", "lines", "grid"] },
        radius: { type: "integer" },
        base: { type: "string", enum: ["notebook", "editorial", "bento", "cinematic", "collage"] },
        heading: { type: "string", enum: ["readex", "plex", "amiri", "scheherazade", "markazi", "messiri", "reemkufi", "tajawal", "playpen", "lalezar", "baloo"] },
        body: { type: "string", enum: ["readex", "plex", "amiri", "scheherazade", "markazi", "messiri", "reemkufi", "tajawal", "playpen", "lalezar", "baloo"] },
        accent: { type: "string", enum: ["readex", "plex", "amiri", "scheherazade", "markazi", "messiri", "reemkufi", "tajawal", "playpen", "lalezar", "baloo"] },
        notes: str,
      },
      required: ["colors", "texture", "radius", "base", "heading", "body", "accent", "notes"],
      additionalProperties: false,
    },
    maxTokens: 4000,
    effort: "low",
  });
  const d = r.data;
  const draft: Design = {
    main: d.base as Design["main"],
    roles: {},
    fonts: { heading: d.heading, body: d.body, accent: d.accent },
    custom: { description, colors: d.colors, texture: d.texture, radius: Math.max(0, Math.min(24, d.radius)), notes: d.notes },
  };
  await saveOutput(o.id, { settings: { ...o.settings, _styleDraft: draft } });
  return { done: true, usd: r.usd, stage: "فهم الأسلوب جاهز للمراجعة" };
}

// ───────────────────────────── handlers ─────────────────────────────

async function failed(job: Job, message: string) {
  if (!job.output_id) return;
  const o = await getOutput(job.user_id, job.output_id);
  const back: Record<string, string> = { plan: o.plan ? "plan_review" : "settings", trial: "trial_offer", style: o.status };
  await saveOutput(o.id, { status: back[job.kind] ?? "failed", error: message });
}

const outputHandler = (label: string, step: (job: Job) => Promise<StepResult>): Handler => ({ label, step, onFail: failed });

export const planHandler = outputHandler("إعداد الخطة", planStep);
export const trialHandler = outputHandler("النسخة التجريبية", trialStep);
export const finalHandler = outputHandler("إنشاء الناتج", finalStep);
export const reviseHandler = outputHandler("تعديل الناتج", finalStep);
export const styleHandler = outputHandler("فهم الأسلوب الخاص", styleStep);
