// «الطالب الذكي» · «حيدرا ماكس» — an output DESIGNED IN CODE by Claude Code (settings.maker = "max"; slides also
// render = "design"): the output's content becomes a deck of free-form pages (src/lib/slides) — slides, or printed A4
// pages for a summary, a book, a quiz, a mind map, a brochure…: a few pages per step, then the pages are drawn in a real
// browser, measured and LOOKED AT, and fixed where they are not right; then the files (PDF, and the slides' editable
// PPTX). The deck lives in the output's content (slides: `content`, everything else: `content.max`), so the editor
// («🎨 محرر العرض»), the show and the exports all read the same pages. Server only.

import { fontById, STYLES, styleById, type Design } from "@config/jawad/student";
import { askJson, claudeCeilingUsd } from "./claude";
import { getFile, putFile, saveOutput, signFile, type Output } from "./db";
import { colorsOf } from "./render/css";
import { DESIGN_BATCH, designBatch, isPage, placeSlide, reviewBatch, type Ask, type DeckStyle, type SlideBrief } from "@/lib/slides/design";
import { deckImages, readDeck, sigOf, type Deck, type DeckAspect } from "@/lib/slides/format";
import { deckPdf, deckPngs, deckPptx, measureDeck } from "@/lib/slides/render";
import type { StepResult } from "./jobs";

/** What an output is, as pages to design: the briefs (one per page), what they were made from, and what they are. */
export interface MaxSource {
  title: string;
  aspect: DeckAspect;
  briefs: SlideBrief[];
  /** a signature of each brief's content (a changed page is designed again; the others are kept) */
  sigs: string[];
  /** what the pages are and how they are used (given to the designer) */
  purpose: string;
}

export const asDesigned = (o: Output) => o.kind === "slides" && (o.settings.render === "design" || o.settings.maker === "max");

interface DeckContent {
  deck: Deck;
  /** pages designed but not looked at yet */
  unchecked: number[];
  overflow?: number[];
  /** the person changed the deck by hand (moved, added, removed or edited pages): the content no longer redesigns it */
  manual?: boolean;
}

/** Where the deck is kept: slides keep it in `content`; every other output in `content.max` (its own content stays as it is). */
export const slotOf = (o: Output): Partial<DeckContent> => {
  const c = (o.content ?? {}) as Record<string, unknown>;
  return (o.kind === "slides" ? c : (c.max ?? {})) as Partial<DeckContent>;
};
export const slotPatch = (o: Output, patch: Record<string, unknown>) => {
  const c = (o.content ?? {}) as Record<string, unknown>;
  return o.kind === "slides" ? { ...c, ...patch } : { ...c, max: { ...((c.max ?? {}) as Record<string, unknown>), ...patch } };
};

export function deckContent(o: Output, src: MaxSource, design: Design): DeckContent {
  const c = slotOf(o);
  const deck = readDeck(c.deck) ?? { v: 1 as const, title: src.title, aspect: src.aspect, fonts: [], slides: [] };
  deck.title = src.title || deck.title;
  deck.aspect = src.aspect;
  deck.fonts = [...new Set([design.fonts.heading, design.fonts.body, design.fonts.accent])];
  const manual = Boolean(c.manual);
  // the content may have lost pages since: the deck follows it (a deck changed by hand keeps its own pages)
  if (!manual) deck.slides = deck.slides.slice(0, src.briefs.length);
  return { deck, manual, unchecked: Array.isArray(c.unchecked) ? c.unchecked.filter((i) => Number.isInteger(i) && i < deck.slides.length) : [], overflow: c.overflow };
}

/** What a page is designed from: its content and the look. */
export const pageSig = (src: MaxSource, i: number, design: Design) => sigOf({ s: src.sigs[i], d: design, a: src.aspect });

export function deckStyle(o: Output, design: Design): DeckStyle {
  const st = styleById(design.main) ?? STYLES[0];
  return {
    colors: colorsOf(design, design.main),
    fonts: { heading: fontById(design.fonts.heading).family, body: fontById(design.fonts.body).family, accent: fontById(design.fonts.accent).family },
    direction: [design.custom?.description, design.custom?.notes, `${st.name}: ${st.idea} ${o.kind === "slides" ? st.inSlides : st.inPdf}`, o.settings.audience && `audience: ${String(o.settings.audience)}`].filter(Boolean).join(" — "),
  };
}

const ask: Ask = (o) => askJson({ ...o, effort: "medium" });
/** A printed page carries much more markup than a slide: fewer at a time. */
const batchOf = (aspect: DeckAspect) => (isPage(aspect) ? 2 : DESIGN_BATCH);

/** Pages (within the first `limit`) still to design: never designed, or designed from other content / another look. */
const toDesign = (deck: Deck, src: MaxSource, design: Design, limit: number, manual = false) =>
  manual
    ? []
    : src.briefs
        .slice(0, limit)
        .map((_, i) => i)
        .filter((i) => !deck.slides[i]?.edited && deck.slides[i]?.sig !== pageSig(src, i, design));

/** The images of the deck as data: URIs (the server's renders). */
async function dataImages(deck: Deck) {
  const out: Record<string, string> = {};
  for (const p of deckImages(deck)) {
    try {
      const b = await getFile(p);
      out[p] = `data:image/${p.endsWith(".png") ? "png" : p.endsWith(".webp") ? "webp" : "jpeg"};base64,${b.toString("base64")}`;
    } catch {}
  }
  return out;
}

/** One step of designing (a batch) or of checking (a batch looked at and fixed); null when every page is done. */
export async function deckStep(o: Output, src: MaxSource, design: Design, limit = src.briefs.length): Promise<StepResult | null> {
  limit = Math.min(limit, src.briefs.length);
  const c = deckContent(o, src, design);
  const style = deckStyle(o, design);
  const todo = toDesign(c.deck, src, design, limit, c.manual);
  const batch = batchOf(src.aspect);
  const page = isPage(src.aspect);
  if (todo.length) {
    const idx = todo.slice(0, batch);
    const ref = c.deck.slides.map((s, i) => ({ index: i, html: s?.html ?? "" })).filter((s, i) => s.html && !idx.includes(i)).slice(0, page ? 1 : 2);
    const r = await designBatch(ask, { aspect: c.deck.aspect, style, briefs: src.briefs, idx, ref, extra: String(o.settings.extra ?? ""), purpose: src.purpose });
    for (const s of r.slides) placeSlide(c.deck, s.index, s.html, s.notes || src.briefs[s.index].notes, pageSig(src, s.index, design), src.briefs[s.index].id);
    // a page Claude skipped is filled so the deck never has a hole (it is designed again next step)
    for (let i = 0; i < c.deck.slides.length; i++) if (!c.deck.slides[i]) c.deck.slides[i] = { id: src.briefs[i]?.id ?? `s${i + 1}`, html: `<section data-slide="s${i + 1}"></section>`, notes: "", sig: "" };
    const unchecked = [...new Set([...c.unchecked, ...r.slides.map((s) => s.index)])];
    await saveOutput(o.id, { content: slotPatch(o, { deck: c.deck, unchecked, manual: c.manual }) });
    const done = limit - toDesign(c.deck, src, design, limit, c.manual).length;
    return { done: false, usd: r.usd, stage: `حيدرا ماكس يصمم ${page ? "الصفحات" : "الشرائح"}: ${done} من ${limit}` };
  }
  if (c.unchecked.length) {
    const idx = c.unchecked.slice(0, batch);
    const imgs = await dataImages(c.deck);
    const resolve = (p: string) => imgs[p];
    const [pngs, problems] = await Promise.all([deckPngs(c.deck, resolve, { only: idx, scale: page ? 0.4 : 0.5 }), measureDeck(c.deck, resolve, idx)]);
    const pics: Record<number, string> = {};
    for (const p of pngs) {
      const path = `${o.user_id}/${o.project_id}/out/${o.id}/check-${Date.now()}-${p.index}.png`;
      await putFile(path, p.png, "image/png");
      pics[p.index] = await signFile(path, 900);
    }
    const r = await reviewBatch(ask, { aspect: c.deck.aspect, style, problems, purpose: src.purpose, slides: idx.map((i) => ({ index: i, html: c.deck.slides[i].html, notes: c.deck.slides[i].notes, picture: pics[i] })) });
    let fixed = 0;
    for (const s of r.slides) {
      if (!s.html.trim()) continue;
      placeSlide(c.deck, s.index, s.html, s.notes || c.deck.slides[s.index].notes, c.deck.slides[s.index].sig ?? pageSig(src, s.index, design));
      fixed++;
    }
    await saveOutput(o.id, { content: slotPatch(o, { deck: c.deck, unchecked: c.unchecked.filter((i) => !idx.includes(i)), manual: c.manual }) });
    return { done: false, usd: r.usd, stage: `حيدرا ماكس يراجع ${page ? "الصفحات" : "الشرائح"} وهي مرسومة${fixed ? ` (صلّح ${fixed})` : ""}` };
  }
  return null;
}

/** One page designed again with the person's request («🤖 اطلب من حيدرا ماكس» in the editor). */
export async function redesignSlide(o: Output, src: MaxSource, design: Design, i: number, note: string): Promise<StepResult> {
  const c = deckContent(o, src, design);
  if (!c.deck.slides[i]) throw new Error("no such page");
  // a deck changed by hand: the page is what it shows now, not its old place in the content
  const briefs = [...src.briefs];
  while (briefs.length < c.deck.slides.length) briefs.push({ title: "", idea: "", layout: "", text: [], notes: "", visual: "", image: null });
  if (c.manual) briefs[i] = { title: "(as on the page now)", idea: "", layout: "as it is now", text: [], notes: c.deck.slides[i].notes, visual: "", image: null };
  const r = await designBatch(ask, { aspect: c.deck.aspect, style: deckStyle(o, design), briefs, idx: [i], ref: c.deck.slides.map((s, k) => ({ index: k, html: s.html })).filter((s) => s.index !== i).slice(0, 2), current: [{ index: i, html: c.deck.slides[i].html }], note, extra: String(o.settings.extra ?? ""), purpose: src.purpose });
  const s = r.slides[0];
  if (s) placeSlide(c.deck, i, s.html, s.notes || c.deck.slides[i].notes, c.deck.slides[i].sig ?? pageSig(src, i, design));
  await saveOutput(o.id, { content: slotPatch(o, { deck: c.deck, unchecked: [...new Set([...c.unchecked, i])], manual: c.manual }) });
  return { done: false, usd: r.usd, progress: { redesigned: true }, stage: `حيدرا ماكس يعدّل ${isPage(src.aspect) ? "الصفحة" : "الشريحة"} ${i + 1}` };
}

const outPath = (o: Output, name: string) => `${o.user_id}/${o.project_id}/out/${o.id}/${Date.now()}-${name}`;

/** A deck with only the pages `pick` keeps (a quiz's questions without its answers). */
const only = (deck: Deck, pick: (s: Deck["slides"][number], i: number) => boolean): Deck => ({ ...deck, slides: deck.slides.filter(pick) });

/** The deck's PDF and editable PPTX (slides), or its PDF (printed pages); `first` = only the first pages (the trial). */
export async function deckFiles(o: Output, deck: Deck, first?: number, kind?: "pdf" | "pptx") {
  const d: Deck = first ? { ...deck, slides: deck.slides.slice(0, first) } : deck;
  const imgs = await dataImages(d);
  const resolve = (p: string) => imgs[p];
  const tag = first ? "trial" : o.kind === "slides" ? "slides" : "pages";
  let pdfPath = "";
  if (kind !== "pptx") {
    pdfPath = outPath(o, `${tag}.pdf`);
    await putFile(pdfPath, await deckPdf(d, resolve), "application/pdf");
  }
  if (first || kind === "pdf" || isPage(d.aspect)) return { pdfPath, pptxPath: "" };
  const pptxPath = outPath(o, `${tag}.pptx`);
  await putFile(pptxPath, await deckPptx(d, resolve), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  return { pdfPath, pptxPath };
}

/**
 * The files an output made by حيدرا ماكس comes with, by its kind (the same names the output's own makers use, so the
 * pages that show and link them work as they are): slides pdf + pptx; a quiz its sheet and its answer key; a mind map each
 * map as a picture and all of them in one PDF; the rest one PDF.
 */
export async function maxFiles(o: Output, deck: Deck): Promise<Record<string, string>> {
  const imgs = await dataImages(deck);
  const resolve = (p: string) => imgs[p];
  const pdf = async (name: string, d: Deck, mime = "application/pdf") => {
    const path = outPath(o, name);
    await putFile(path, await deckPdf(d, resolve), mime);
    return path;
  };
  if (o.kind === "slides") {
    const r = await deckFiles(o, deck);
    return { pdf: r.pdfPath, pptx: r.pptxPath };
  }
  if (o.kind === "quiz") return { quiz_pdf: await pdf("quiz.pdf", only(deck, (s) => !s.id.startsWith("ans"))), answers_pdf: await pdf("answers.pdf", only(deck, (s) => s.id.startsWith("ans"))) };
  if (o.kind === "mindmap") {
    const files: Record<string, string> = {};
    const shots = await deckPngs(deck, resolve, { scale: 1 });
    for (const s of shots) {
      const path = outPath(o, `map-${s.index + 1}.png`);
      await putFile(path, s.png, "image/png");
      files[`map_${s.index + 1}`] = path;
    }
    files.maps_pdf = await pdf("maps.pdf", deck);
    return files;
  }
  return { pdf: await pdf(`${o.kind}.pdf`, deck) };
}

/** The design and its check for `n` pages (ceilings; the real cost is settled). */
export function deckUsd(n: number, aspect: DeckAspect = "16:9") {
  const batch = batchOf(aspect);
  const outPerPage = isPage(aspect) ? 9000 : 6000;
  const batches = Math.ceil(n / batch);
  const per = claudeCeilingUsd(16_000, outPerPage * batch + 2000) + claudeCeilingUsd(30_000, (isPage(aspect) ? 6500 : 5000) * batch + 1500, batch * 900);
  return batches * per;
}
export const deckSlideUsd = (aspect: DeckAspect = "16:9") => claudeCeilingUsd(16_000, isPage(aspect) ? 11_000 : 8000) + claudeCeilingUsd(20_000, 6500, 900);

/** Pages still to design (the estimate before the student agrees). */
export function deckTodo(o: Output, src: MaxSource, design: Design, limit = src.briefs.length) {
  const c = deckContent(o, src, design);
  return toDesign(c.deck, src, design, Math.min(limit, src.briefs.length), c.manual).length;
}
