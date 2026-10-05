// «الطالب الذكي» — slides made as pictures with GPT Image 2 (the student's choice): each slide of the approved map is
// drawn whole (title, text, visual) in the chosen style, then the pictures are put together as a PDF (and a PPTX of
// full-slide pictures). The text in a picture cannot be edited, and the model can misspell Arabic: the student is told
// before choosing, and can have any one slide drawn again.

import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { fontById, styleById } from "@config/jawad/student";
import { GPT_IMAGE_2_SIZES, gptImage2OutputTokens } from "@config/jawad/generators";
import { providerUserId } from "@/lib/jawad/server/providers/common";
import { openaiImage } from "@/lib/jawad/server/providers/openai";
import { colorsOf } from "./render/css";
import { getFile, putFile, sources, type Output } from "./db";
import type { Design } from "@config/jawad/student";
import type { Slide, SlidePlan } from "./model";

const MODEL = "gpt-image-2-2026-04-21";
/** OpenAI's gpt-image-2 prices (USD per 1M tokens): image out 30 · image in 8 · text in 5. */
const OUT = 30;
const REF_TOKENS = 7100;

export type SlideQuality = "medium" | "high";
const ASPECT = "16:9";

/** USD ceiling of one slide picture: the output at the chosen quality, a style reference and the prompt. */
export function slideImageUsd(quality: SlideQuality) {
  const [w, h] = GPT_IMAGE_2_SIZES.hi[ASPECT];
  return (gptImage2OutputTokens(w, h, quality) * OUT + REF_TOKENS * 8 * 2 + 2000 * 5) / 1e6;
}

/** What a slide picture depends on: when it changes, the picture is drawn again. */
export function slideSig(s: Slide, design: Design, quality: SlideQuality, note = "") {
  return createHash("sha256").update(JSON.stringify([s.title, s.text, s.layout, s.visual, s.image.mode, s.image.sourceId, design, quality, note])).digest("hex").slice(0, 16);
}

const LAYOUT: Record<Slide["layout"], string> = {
  title: "an opening title slide: the title large and centred, the subtitle under it",
  section: "a section divider: the title large, little else",
  bullets: "a title and a short list of points, one per line",
  cards: "a title and the points as separate cards in a clear grid read right to left (each card: bold label then text)",
  compare: "a title and a clean comparison table (the first row is the header)",
  quote: "a quotation shown large and centred",
  image: "a title, a picture on one side and the points on the other",
};

function prompt(s: Slide, i: number, total: number, deckTitle: string, design: Design, note: string, hasStyleRef: boolean) {
  const st = styleById(design.main);
  const c = colorsOf(design, design.main);
  const custom = design.custom ? ` The student's own description of the style: "${design.custom.description}".` : "";
  const lines = s.text.filter(Boolean);
  return [
    `Design ONE finished presentation slide as a single 16:9 image (slide ${i + 1} of ${total} of the study deck "${deckTitle}").`,
    `Language and direction: Arabic, right-to-left layout (text aligned right, reading order right to left).`,
    `Visual style: ${st.en} — ${st.idea}${custom} Colours: background ${c.bg}, surface ${c.paper}, text ${c.ink}, accent ${c.accent}, second accent ${c.accent2}.`,
    `Typography: clean modern Arabic lettering similar to "${fontById(design.fonts.heading).family}" for the title and "${fontById(design.fonts.body).family}" for the text; large, high contrast, generous margins, nothing cropped.`,
    `Layout: ${LAYOUT[s.layout]}.`,
    `Write EXACTLY this Arabic text and no other words — every letter correct and properly joined, no made-up or garbled letters, no extra captions or watermarks:`,
    `Title: «${s.title}»`,
    ...lines.map((l) => `Line: «${l}»`),
    s.visual ? `Visual element (illustrative, not documentary): ${s.visual}.` : "",
    `Put the slide number "${i + 1}" small in a lower corner.`,
    hasStyleRef ? `The reference image is an earlier slide of the same deck: keep the same visual identity (colours, typography, decoration, margins) with this slide's own content and layout; do not copy its text.` : "",
    note ? `The student's request for this slide: ${note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Draws slide i (the first drawn slide is the style reference for the others). Returns the new path and cost. */
export async function drawSlide(o: Output, plan: SlidePlan, i: number, design: Design, quality: SlideQuality, note = "") {
  const s = plan.slides[i];
  const refs: { bytes: Buffer; mime: string }[] = [];
  const styleRef = plan.slides.find((x, k) => k !== i && x.rendered?.path);
  if (styleRef?.rendered) refs.push({ bytes: await getFile(styleRef.rendered.path), mime: "image/png" });
  if (s.image.mode === "own" && s.image.sourceId) {
    const src = (await sources(o.project_id)).find((x) => x.id === s.image.sourceId && x.kind === "image");
    if (src?.path) refs.push({ bytes: await getFile(src.path), mime: src.mime || "image/png" });
  }
  const res = await openaiImage({
    model: MODEL,
    prompt: prompt(s, i, plan.slides.length, plan.title, design, note, Boolean(styleRef)) + (s.image.mode === "own" ? "\nUse the student's own photo (the last reference image) as the slide's picture." : ""),
    aspect: ASPECT,
    resolution: "hi",
    quality,
    count: 1,
    references: refs,
    user: providerUserId(o.user_id),
  });
  const path = `${o.user_id}/${o.project_id}/slides/${o.id}/${i + 1}-${Date.now()}.png`;
  await putFile(path, res.images[0], "image/png");
  return { path, usd: res.costUsd ?? slideImageUsd(quality) };
}

/** The slide pictures as one PDF, one page per slide, in order. */
export async function picturesPdf(paths: string[]) {
  const doc = await PDFDocument.create();
  for (const p of paths) {
    const png = await doc.embedPng(await getFile(p));
    // half the pixel size in points: a 2048×1152 slide becomes a 1024×576 pt page (same picture, sensible page size)
    const w = png.width / 2;
    const h = png.height / 2;
    doc.addPage([w, h]).drawImage(png, { x: 0, y: 0, width: w, height: h });
  }
  const out = Buffer.from(await doc.save());
  if (doc.getPageCount() !== paths.length || out.length < 1000) throw new Error("slide PDF incomplete");
  return out;
}

/** The same pictures as a PPTX (each slide one full picture, with the speaker notes). */
export async function picturesPptx(plan: SlidePlan, paths: string[]) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.rtlMode = true;
  pptx.title = plan.title;
  for (const [i, p] of paths.entries()) {
    const slide = pptx.addSlide();
    slide.addImage({ data: `data:image/png;base64,${(await getFile(p)).toString("base64")}`, x: 0, y: 0, w: 10, h: 5.625 });
    if (plan.slides[i]?.notes) slide.addNotes(plan.slides[i].notes);
  }
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
