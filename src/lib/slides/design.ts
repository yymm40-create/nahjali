// «مصمم العروض» — how Claude DESIGNS slides (not fills a template): the format he writes (the closed set of tags and
// inline styles of src/lib/slides/format.ts), the rules of a presentation designer, then the Claude Code way — the
// slides he wrote are drawn in a real browser and measured, he LOOKS at the pictures with what was measured, and fixes
// the ones that are not right. The robot that calls him (صادق، محمد باقر، قنبر…) passes its own Claude call (its persona
// and billing). Pure prompts and data, plus the loop.

import { DECK_SIZE, sanitizeSlide, type Deck, type DeckAspect } from "./format";

/** What one slide must say (from the robot's slide map). */
export interface SlideBrief {
  title: string;
  /** the one idea of the slide */
  idea: string;
  /** a hint of the kind of slide (title, section, bullets, cards, compare, quote, image…) */
  layout: string;
  /** the words that must be on it */
  text: string[];
  notes: string;
  /** a visual the map proposed */
  visual: string;
  /** a picture made for it, as its img: token, and what it shows */
  image?: { token: string; alt: string } | null;
  /** the id the slide / page keeps (a quiz's answer pages, a brochure's sides) */
  id?: string;
}

/** A printed page (A4 portrait / landscape) rather than a screen slide. */
export const isPage = (aspect: DeckAspect) => aspect === "a4" || aspect === "a4l";

/** The look of the whole deck. */
export interface DeckStyle {
  /** hex colours: page background, surfaces, text, secondary text, two accents, lines */
  colors: { bg: string; paper: string; ink: string; muted: string; accent: string; accent2: string; line: string };
  /** CSS family names: headings, body, an accent face for quotes / notes */
  fonts: { heading: string; body: string; accent: string };
  /** the person's own words about the look, and the style's idea */
  direction: string;
}

export type Ask = <T>(o: { system: string; parts: ({ type: "text"; text: string } | { type: "image"; url: string })[]; schema: object; maxTokens: number }) => Promise<{ data: T; usd: number }>;

/** Slides designed per call (a handful keeps every slide carefully made and the reply well under its limit). */
export const DESIGN_BATCH = 4;
/** Rounds of looking at the drawn slides and fixing them, per batch. */
export const REVIEW_ROUNDS = 1;

export function formatGuide(aspect: DeckAspect) {
  const { w, h } = DECK_SIZE[aspect];
  const paper = aspect === "a4" ? "an A4 portrait sheet (210×297 mm at 192 dpi)" : aspect === "a4l" ? "an A4 landscape sheet (297×210 mm at 192 dpi, printed on both sides)" : "";
  return `${paper ? `THE PAGE FORMAT — every page is ONE <section> on a fixed ${w}×${h} px canvas = ${paper}` : `THE SLIDE FORMAT — every slide is ONE <section> on a fixed ${w}×${h} px canvas`}, Arabic, right to left (the page is dir="rtl": flex rows already run right→left and text-align start is the right side; write naturally). Every style is INLINE (style="…"); there are no classes and no <style>.
Tags: section, div, p, h1, h2, h3, span, b, i, u, br, ul, ol, li, table/tr/th/td, hr, img, and inline <svg> drawings (svg, g, rect, circle, ellipse, line, path, polygon, polyline, defs, linearGradient, radialGradient, stop — no <text> in SVG: labels are <p> over it). Anything else is removed.
CSS you may use: layout (display:flex|grid, flex-direction, flex-wrap, gap, align-items, justify-content, flex, grid-template-columns/rows, grid-column/row as "span N"), size and place (width, height, min/max, padding, margin, position:absolute|relative with left/top/right/bottom — absolute children pin to the slide or to a position:relative box), type (font-family, font-size, font-weight, font-style, line-height, letter-spacing, text-align, white-space, text-transform, text-shadow, -webkit-text-stroke), colour (color, background with solid colours and linear/radial/repeating gradients, background-clip:text with -webkit-text-fill-color:transparent for gradient letters), border, border-radius, box-shadow, opacity, transform (rotate/scale/translate/skew), filter, mix-blend-mode, object-fit on pictures, z-index. NEVER url(), var(), @import, scripts or event attributes (they are stripped).
Pictures: ONLY the deck's own pictures, written exactly as given: <img src="img:…" alt="what it shows" style="width:…px;height:…px;object-fit:cover;border-radius:…px">. Never invent an img: token, never a web address.
The section's own style sets the slide's background (ALWAYS set one) and its default text colour and font, and its layout and padding (the margins: about 100–128 px).`;
}

export const DESIGN_RULES = `HOW A PRESENTATION DESIGNER WORKS (follow all of it):
- One idea per slide. A statement beats bullets; turn lists into card rows, a big number, a timeline, a comparison table, a quote, a diagram drawn in SVG — whatever shows THIS idea best. Vary the layouts across the deck, but keep a rhythm: the title of every content slide in the same place, the same eyebrow/label style, the same footer if any.
- Type scale, the same through the deck: cover/section titles 110–160 px, slide titles 64–84 px, card titles 40–48 px, body 30–38 px, small labels 24–28 px. NOTHING under 24 px. Arabic needs line-height 1.4–1.7 for body text. Headings in the heading face, body in the body face.
- Room: text must fit its box with air around it; the content stays inside the margins; nothing is cut off and nothing runs past the slide's edge. When a slide's words do not fit, use fewer words on the slide (the rest goes to the speaker's notes) — never shrink the type under the scale.
- Colour: the deck's palette only (its hexes), two background tones across the deck plus one bold accent slide (a section divider or a key statement); text keeps strong contrast (4.5:1 for body). Accents for labels, numbers, key words — not for long text.
- Make it alive, never empty or boring: depth with soft shadows and layered shapes, a coloured band or corner shape, big numbers, icons drawn as simple SVG shapes, gradients used with taste, pictures framed with a radius and a shadow (a slight rotation for a playful deck). Decoration never covers or crowds the words.
- Pictures given for a slide are used on that slide (big, as a hero or beside the text), with a meaningful alt.
- Keep the student's / person's words: the slide's text says what the map says (you may shorten for the slide and move the explanation to the notes; never invent facts).`;

/** The designer's rules for a PRINTED page (a summary, a book, a quiz, a mind map, a brochure): readable on paper first. */
export const PAGE_RULES = `HOW A PRINT DESIGNER WORKS (follow all of it) — this is a PRINTED A4 page, read on paper by a student:
- Every word you are given goes on the page, exactly as written (you may arrange, bold a key word, put a term in a box; never drop, shorten or reword the content, never invent facts). A heading may be set bigger; a list stays a list.
- Type for paper (the canvas is 192 dpi: 30 px ≈ 11 pt): body 30–34 px with line-height 1.7–1.85, sub-headings 40–48 px, page titles 60–84 px, small labels 24–26 px. NOTHING under 24 px. Headings in the heading face, body in the body face, left-aligned text never justified, one text column per box (a long page may use two columns).
- Room: margins about 110–140 px; the content stays inside them; text fits its box with air around it and nothing is cut off. When the words are many, keep the type size and lay them out well (columns, boxes) — never shrink under the scale.
- Ink-friendly: a LIGHT page background (white or a pale tint from the palette), colour only in bands, headings, boxes, icons and numbers; never a full-page dark background. Text keeps strong contrast (4.5:1).
- Make it alive and organised, never a wall of text: a coloured header band or side strip, numbered or iconed sections drawn as simple SVG shapes, key terms in tinted boxes, tables with a tinted header row, a footer line with the title and the page number. The same header and footer on every page of a document.
- Pictures given for a page are used on that page, framed with a radius, with a meaningful alt.`;

const SLIDES_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: { type: "object", properties: { index: { type: "integer" }, html: { type: "string" }, notes: { type: "string" } }, required: ["index", "html", "notes"], additionalProperties: false },
    },
  },
  required: ["slides"],
  additionalProperties: false,
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: { index: { type: "integer" }, score: { type: "integer" }, problem: { type: "string" }, html: { type: "string" }, notes: { type: "string" } },
        required: ["index", "score", "problem", "html", "notes"],
        additionalProperties: false,
      },
    },
  },
  required: ["slides"],
  additionalProperties: false,
};

const styleText = (s: DeckStyle) =>
  `THE DECK'S LOOK — palette: background ${s.colors.bg}, surface ${s.colors.paper}, text ${s.colors.ink}, secondary text ${s.colors.muted}, accent ${s.colors.accent}, second accent ${s.colors.accent2}, lines ${s.colors.line}. Fonts: headings font-family:'${s.fonts.heading}', body '${s.fonts.body}', quotes / notes '${s.fonts.accent}' (always end a stack with Tahoma, sans-serif). Direction: ${s.direction || "clean, modern and warm"}.`;

const briefText = (b: SlideBrief, i: number, total: number, page = false) =>
  [
    `${page ? "PAGE" : "SLIDE"} ${i + 1} of ${total} — index ${i}${i === 0 ? " (the cover)" : ""}`,
    `kind: ${b.layout}`,
    `title: ${b.title}`,
    b.idea && `idea: ${b.idea}`,
    b.text.length ? `words on it:\n${b.text.map((t) => `- ${t}`).join("\n")}` : "",
    b.visual && `proposed visual: ${b.visual}`,
    b.image ? `its picture: <img src="${b.image.token}" alt="${b.image.alt.replace(/"/g, "'")}">` : "no picture made for it (draw shapes / SVG instead if it needs a visual)",
    b.notes && `speaker's notes so far: ${b.notes}`,
  ]
    .filter(Boolean)
    .join("\n");

/** Designs slides `idx` of the map; `ref` = slides already designed (their markup keeps the deck consistent). */
export async function designBatch(ask: Ask, o: { aspect: DeckAspect; style: DeckStyle; briefs: SlideBrief[]; idx: number[]; ref: { index: number; html: string }[]; extra?: string; note?: string; current?: { index: number; html: string }[]; /** what the pages are (a summary, a quiz…) and how they are used */ purpose?: string }) {
  const total = o.briefs.length;
  const page = isPage(o.aspect);
  const thing = page ? "page" : "slide";
  const system = `You are ${page ? "a print designer" : "a presentation designer"}. You design each ${thing} from scratch as the format below — free layout, like a designer working in ${page ? "InDesign" : "Keynote"}, not a template. ${o.note ? `The person asked for a change to ${thing}s you designed: apply exactly what they asked, keep the rest of the ${thing} and the document's look.` : ""}${o.purpose ? `\nWHAT THIS IS: ${o.purpose}` : ""}

${formatGuide(o.aspect)}

${page ? PAGE_RULES : DESIGN_RULES}

${styleText(o.style)}${o.extra ? `\n\nTHE PERSON'S OWN REQUESTS (they come first): ${o.extra}` : ""}

Return every ${thing} asked for: its index, its whole <section …>…</section> markup, and ${page ? "notes (a short plain Arabic line saying what the page holds; may be empty)" : "the speaker's notes (plain Arabic text: what the presenter says on this slide; keep or improve the notes given)"}.`;
  const parts: { type: "text"; text: string }[] = [];
  if (o.ref.length) parts.push({ type: "text", text: `SLIDES ALREADY DESIGNED (keep the same look, type scale and rhythm):\n${o.ref.map((r) => `— slide index ${r.index}:\n${r.html}`).join("\n\n")}` });
  if (o.current?.length) parts.push({ type: "text", text: `THE SLIDES AS THEY ARE NOW:\n${o.current.map((r) => `— slide index ${r.index}:\n${r.html}`).join("\n\n")}` });
  parts.push({ type: "text", text: `THE DECK'S MAP (${total} slides; for context):\n${o.briefs.map((b, i) => `${i + 1}. ${b.title}`).join("\n")}\n\nDESIGN THESE SLIDES:\n\n${o.idx.map((i) => briefText(o.briefs[i], i, total, page)).join("\n\n")}${o.note ? `\n\nTHE PERSON ASKS: ${o.note}` : ""}` });
  const r = await ask<{ slides: { index: number; html: string; notes: string }[] }>({ system, parts, schema: SLIDES_SCHEMA, maxTokens: 6000 * o.idx.length + 2000 });
  return { slides: r.data.slides.filter((s) => o.idx.includes(s.index)), usd: r.usd };
}

/**
 * Claude LOOKS at the drawn slides (pictures) with what the browser measured, scores each like a harsh art director
 * and rewrites the ones under 8 or with a measured problem; a slide that is fine comes back with an empty html.
 */
export async function reviewBatch(ask: Ask, o: { aspect: DeckAspect; style: DeckStyle; slides: { index: number; html: string; notes: string; picture: string }[]; problems: [number, string][]; purpose?: string }) {
  const page = isPage(o.aspect);
  const system = `You are the art director checking ${page ? "printed pages" : "slides"} a designer just made.${o.purpose ? ` What they are: ${o.purpose}` : ""} You see each slide as it really renders (a picture) and what the browser measured on it. Score each slide 1–10 like a harsh expert: is everything readable and inside the slide, nothing cut off or overlapping, the type scale kept (nothing under 24 px), the layout balanced, alive and on-brand, the idea clear at a glance? For every slide under 8, or with ANY measured problem, rewrite its whole <section> fixing it (same content and look, better made). For a slide that is right, return html "" (empty) and its notes unchanged.

${formatGuide(o.aspect)}

${page ? PAGE_RULES : DESIGN_RULES}

${styleText(o.style)}`;
  const parts: ({ type: "text"; text: string } | { type: "image"; url: string })[] = [];
  for (const s of o.slides) {
    const found = o.problems.filter(([i]) => i === s.index).map(([, m]) => m);
    parts.push({ type: "text", text: `— slide index ${s.index}. Measured: ${found.length ? found.join("; ") : "nothing wrong measured"}.\nIts markup:\n${s.html}\nIts notes: ${s.notes}\nHow it renders:` });
    parts.push({ type: "image", url: s.picture });
  }
  const r = await ask<{ slides: { index: number; score: number; problem: string; html: string; notes: string }[] }>({ system, parts, schema: REVIEW_SCHEMA, maxTokens: 5000 * o.slides.length + 1500 });
  return { slides: r.data.slides.filter((s) => o.slides.some((x) => x.index === s.index)), usd: r.usd };
}

/** A designed slide into the deck (sanitized; an id per place). */
export function placeSlide(deck: Deck, index: number, html: string, notes: string, sig: string, id?: string) {
  id = deck.slides[index]?.id ?? (id ? id.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "") ?? "";
  if (!id) id = `s${index + 1}-${sig.slice(0, 4)}`;
  deck.slides[index] = { id, html: sanitizeSlide(html, id), notes: String(notes ?? "").slice(0, 4000), sig };
}
