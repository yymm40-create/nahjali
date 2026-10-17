// «الطالب الذكي» — slides DESIGNED by صادق (settings.render = "design"): the approved slide map becomes a deck of
// free-form slides (src/lib/slides): a few slides per step, then he looks at them drawn in a real browser with what was
// measured and fixes what is not right, then the PDF and the editable PPTX. The deck lives in the output's content,
// so the editor («🎨 محرر العرض»), the show and the exports all read the same slides. Server only.

import { fontById, STYLES, styleById, type Design } from "@config/jawad/student";
import { askJson, claudeCeilingUsd } from "./claude";
import { getFile, putFile, saveOutput, signFile, type Output } from "./db";
import type { SlidePlan } from "./model";
import { colorsOf } from "./render/css";
import { DESIGN_BATCH, designBatch, placeSlide, reviewBatch, type Ask, type DeckStyle, type SlideBrief } from "@/lib/slides/design";
import { deckImages, readDeck, sigOf, type Deck, type DeckAspect } from "@/lib/slides/format";
import { deckPdf, deckPngs, deckPptx, measureDeck } from "@/lib/slides/render";
import type { StepResult } from "./jobs";

export const asDesigned = (o: Output) => o.kind === "slides" && o.settings.render === "design";

interface DeckContent {
  deck: Deck;
  /** slides designed but not looked at yet */
  unchecked: number[];
  overflow?: number[];
  /** the person changed the deck by hand (moved, added, removed or edited slides): the map no longer redesigns it */
  manual?: boolean;
}

const aspectOf = (o: Output): DeckAspect => (o.settings.aspect === "4:3" ? "4:3" : "16:9");

export function deckContent(o: Output, plan: SlidePlan, design: Design): DeckContent {
  const c = (o.content ?? {}) as Partial<DeckContent>;
  const deck = readDeck(c.deck) ?? { v: 1 as const, title: plan.title, aspect: aspectOf(o), fonts: [], slides: [] };
  deck.title = plan.title || deck.title;
  deck.aspect = aspectOf(o);
  deck.fonts = [...new Set([design.fonts.heading, design.fonts.body, design.fonts.accent])];
  const manual = Boolean(c.manual);
  // the map may have lost slides since: the deck follows it (a deck changed by hand keeps its own slides)
  if (!manual) deck.slides = deck.slides.slice(0, plan.slides.length);
  return { deck, manual, unchecked: Array.isArray(c.unchecked) ? c.unchecked.filter((i) => Number.isInteger(i) && i < deck.slides.length) : [], overflow: c.overflow };
}

/** What a slide is designed from: its place in the map, its picture and the look. */
export const briefSig = (plan: SlidePlan, i: number, design: Design) => {
  const s = plan.slides[i];
  return sigOf({ t: s.title, x: s.text, l: s.layout, v: s.visual, p: s.image.path, d: design });
};

export function briefsOf(plan: SlidePlan): SlideBrief[] {
  return plan.slides.map((s) => ({
    title: s.title,
    idea: s.idea,
    layout: s.layout,
    text: s.text.filter(Boolean),
    notes: s.notes,
    visual: s.visual,
    image: s.image.path ? { token: `img:${s.image.path}`, alt: s.image.prompt || s.visual || s.title } : null,
  }));
}

export function deckStyle(o: Output, design: Design): DeckStyle {
  const st = styleById(design.main) ?? STYLES[0];
  return {
    colors: colorsOf(design, design.main),
    fonts: { heading: fontById(design.fonts.heading).family, body: fontById(design.fonts.body).family, accent: fontById(design.fonts.accent).family },
    direction: [design.custom?.description, design.custom?.notes, `${st.name}: ${st.idea} ${st.inSlides}`, o.settings.audience && `audience: ${String(o.settings.audience)}`].filter(Boolean).join(" — "),
  };
}

const ask: Ask = (o) => askJson({ ...o, effort: "medium" });

/** Slides (within the first `limit`) still to design: never designed, or designed from another map / look. */
const toDesign = (deck: Deck, plan: SlidePlan, design: Design, limit: number, manual = false) =>
  manual ? [] : plan.slides
    .slice(0, limit)
    .map((_, i) => i)
    .filter((i) => !deck.slides[i]?.edited && deck.slides[i]?.sig !== briefSig(plan, i, design));

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

/** One step of designing (a batch) or of checking (a batch looked at and fixed); null when every slide is done. */
export async function deckStep(o: Output, plan: SlidePlan, design: Design, limit = plan.slides.length): Promise<StepResult | null> {
  limit = Math.min(limit, plan.slides.length);
  const c = deckContent(o, plan, design);
  const style = deckStyle(o, design);
  const briefs = briefsOf(plan);
  const todo = toDesign(c.deck, plan, design, limit, c.manual);
  if (todo.length) {
    const idx = todo.slice(0, DESIGN_BATCH);
    const ref = c.deck.slides.map((s, i) => ({ index: i, html: s?.html ?? "" })).filter((s, i) => s.html && !idx.includes(i)).slice(0, 2);
    const r = await designBatch(ask, { aspect: c.deck.aspect, style, briefs, idx, ref, extra: String(o.settings.extra ?? "") });
    for (const s of r.slides) placeSlide(c.deck, s.index, s.html, s.notes || plan.slides[s.index].notes, briefSig(plan, s.index, design));
    // a slide Claude skipped is filled so the deck never has a hole (it is designed again next step)
    for (let i = 0; i < c.deck.slides.length; i++) if (!c.deck.slides[i]) c.deck.slides[i] = { id: `s${i + 1}`, html: `<section data-slide="s${i + 1}"></section>`, notes: "", sig: "" };
    const unchecked = [...new Set([...c.unchecked, ...r.slides.map((s) => s.index)])];
    await saveOutput(o.id, { content: { ...c, unchecked } });
    const done = limit - toDesign(c.deck, plan, design, limit, c.manual).length;
    return { done: false, usd: r.usd, stage: `صادق يصمم الشرائح: ${done} من ${limit}` };
  }
  if (c.unchecked.length) {
    const idx = c.unchecked.slice(0, DESIGN_BATCH);
    const imgs = await dataImages(c.deck);
    const resolve = (p: string) => imgs[p];
    const [pngs, problems] = await Promise.all([deckPngs(c.deck, resolve, { only: idx, scale: 0.5 }), measureDeck(c.deck, resolve, idx)]);
    const pics: Record<number, string> = {};
    for (const p of pngs) {
      const path = `${o.user_id}/${o.project_id}/out/${o.id}/check-${Date.now()}-${p.index}.png`;
      await putFile(path, p.png, "image/png");
      pics[p.index] = await signFile(path, 900);
    }
    const r = await reviewBatch(ask, { aspect: c.deck.aspect, style, problems, slides: idx.map((i) => ({ index: i, html: c.deck.slides[i].html, notes: c.deck.slides[i].notes, picture: pics[i] })) });
    let fixed = 0;
    for (const s of r.slides) {
      if (!s.html.trim()) continue;
      placeSlide(c.deck, s.index, s.html, s.notes || c.deck.slides[s.index].notes, c.deck.slides[s.index].sig ?? briefSig(plan, s.index, design));
      fixed++;
    }
    await saveOutput(o.id, { content: { ...c, unchecked: c.unchecked.filter((i) => !idx.includes(i)) } });
    return { done: false, usd: r.usd, stage: `صادق يراجع الشرائح وهي مرسومة${fixed ? ` (صلّح ${fixed})` : ""}` };
  }
  return null;
}

/** One slide designed again with the person's request («🤖 اطلب من صادق» in the editor, or «عدّل» with the slide). */
export async function redesignSlide(o: Output, plan: SlidePlan, design: Design, i: number, note: string): Promise<StepResult> {
  const c = deckContent(o, plan, design);
  if (!c.deck.slides[i]) throw new Error("no such slide");
  // a deck changed by hand: the slide is what it shows now, not its old place in the map
  const briefs = briefsOf(plan);
  while (briefs.length < c.deck.slides.length) briefs.push({ title: "", idea: "", layout: "", text: [], notes: "", visual: "", image: null });
  if (c.manual) briefs[i] = { title: "(as on the slide now)", idea: "", layout: "as it is now", text: [], notes: c.deck.slides[i].notes, visual: "", image: null };
  const r = await designBatch(ask, { aspect: c.deck.aspect, style: deckStyle(o, design), briefs, idx: [i], ref: c.deck.slides.map((s, k) => ({ index: k, html: s.html })).filter((s) => s.index !== i).slice(0, 2), current: [{ index: i, html: c.deck.slides[i].html }], note, extra: String(o.settings.extra ?? "") });
  const s = r.slides[0];
  if (s) placeSlide(c.deck, i, s.html, s.notes || c.deck.slides[i].notes, c.deck.slides[i].sig ?? briefSig(plan, i, design));
  await saveOutput(o.id, { content: { ...c, unchecked: [...new Set([...c.unchecked, i])] } });
  return { done: false, usd: r.usd, progress: { redesigned: true }, stage: `صادق يعدّل الشريحة ${i + 1}` };
}

const outPath = (o: Output, name: string) => `${o.user_id}/${o.project_id}/out/${o.id}/${Date.now()}-${name}`;

/** The deck's PDF and editable PPTX (all slides, or the first few for the trial). */
export async function deckFiles(o: Output, deck: Deck, only?: number, kind?: "pdf" | "pptx") {
  const d: Deck = only ? { ...deck, slides: deck.slides.slice(0, only) } : deck;
  const imgs = await dataImages(d);
  const resolve = (p: string) => imgs[p];
  const tag = only ? "trial" : "slides";
  let pdfPath = "";
  if (kind !== "pptx") {
    pdfPath = outPath(o, `${tag}.pdf`);
    await putFile(pdfPath, await deckPdf(d, resolve), "application/pdf");
  }
  if (only || kind === "pdf") return { pdfPath, pptxPath: "" };
  const pptxPath = outPath(o, `${tag}.pptx`);
  await putFile(pptxPath, await deckPptx(d, resolve), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  return { pdfPath, pptxPath };
}

/** The design and its check for `n` slides (ceilings; the real cost is settled). */
export function deckUsd(n: number) {
  const batches = Math.ceil(n / DESIGN_BATCH);
  const per = claudeCeilingUsd(16_000, 6000 * DESIGN_BATCH + 2000) + claudeCeilingUsd(30_000, 5000 * DESIGN_BATCH + 1500, 4 * 900);
  return batches * per;
}
export const deckSlideUsd = () => claudeCeilingUsd(16_000, 8000) + claudeCeilingUsd(20_000, 6500, 900);

/** Slides still to design (the estimate before the student agrees). */
export function deckTodo(o: Output, plan: SlidePlan, design: Design, limit = plan.slides.length) {
  const c = deckContent(o, plan, design);
  return toDesign(c.deck, plan, design, Math.min(limit, plan.slides.length), c.manual).length;
}
