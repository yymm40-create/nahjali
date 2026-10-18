// «مصمم العروض» — the slide format shared by the designer (Claude), the editor, the show and the exports: every slide is
// ONE <section> on a fixed canvas (1920×1080, or 1440×1080 for 4:3), built from a closed set of tags and inline styles
// (the same idea as a designer's deck: free layout, no templates), with pictures as `img:<path>` tokens resolved only
// when the slide is shown. Everything that is saved — Claude's slides or the person's edits — goes through
// sanitizeSlide first: it rebuilds the markup from scratch with only what is allowed (no scripts, no events, no links
// out, no url() in styles), so a slide can never run anything. Pure: strings in, strings out (client and server).

/** Slides (16:9, 4:3) and printed pages: A4 portrait ("a4") and A4 landscape ("a4l", a brochure's sides) at 192 dpi, so a 30 px line is about 11 pt. */
export type DeckAspect = "16:9" | "4:3" | "a4" | "a4l";
export const DECK_SIZE: Record<DeckAspect, { w: number; h: number }> = { "16:9": { w: 1920, h: 1080 }, "4:3": { w: 1440, h: 1080 }, a4: { w: 1588, h: 2246 }, a4l: { w: 2246, h: 1588 } };
/** The paper of a printed aspect, in millimetres (null for a screen). */
export const DECK_PAPER: Partial<Record<DeckAspect, { w: number; h: number }>> = { a4: { w: 210, h: 297 }, a4l: { w: 297, h: 210 } };
/** One canvas pixel in CSS pixels when printed: the page is 96 dpi in CSS, the canvas 192. */
export const PRINT_ZOOM = 0.5;

export interface DeckSlide {
  id: string;
  /** one <section>, sanitized */
  html: string;
  /** the speaker's notes, plain text */
  notes: string;
  /** what the slide was designed from (its place in the slide map and the style): a changed map designs it again */
  sig?: string;
  /** the person changed it by hand in the editor */
  edited?: boolean;
}

export interface Deck {
  v: 1;
  title: string;
  aspect: DeckAspect;
  /** the site's font ids (config/jawad/student FONTS) the slides use */
  fonts: string[];
  slides: DeckSlide[];
}

const MAX_HTML = 60_000;
const MAX_ELEMENTS = 400;

/** HTML elements a slide may hold (anything else is dropped; its text kept unless it is a script-like element). */
const HTML_TAGS = new Set(["section", "div", "p", "h1", "h2", "h3", "span", "b", "strong", "i", "em", "u", "br", "ul", "ol", "li", "img", "table", "thead", "tbody", "tr", "th", "td", "hr", "small", "sup", "sub"]);
/** SVG elements (drawings, charts, waveforms), by their lower-case name → the name SVG wants. */
const SVG_TAGS: Record<string, string> = {
  svg: "svg", g: "g", rect: "rect", circle: "circle", ellipse: "ellipse", line: "line", path: "path", polygon: "polygon", polyline: "polyline",
  defs: "defs", lineargradient: "linearGradient", radialgradient: "radialGradient", stop: "stop",
};
const VOID = new Set(["br", "hr", "img"]);
/** Elements dropped together with everything inside them. */
const DROP_ALL = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template", "textarea", "select", "button", "form", "input", "link", "meta", "head", "title", "math", "foreignobject", "video", "audio", "canvas", "aside", "a", "image", "use", "pattern", "mask", "filter", "clippath", "text", "tspan", "animate", "set", "animatetransform"]);

const SVG_ATTRS = new Set(["width", "height", "viewbox", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "d", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "transform", "offset", "stop-color", "stop-opacity", "gradienttransform", "gradientunits", "id", "preserveaspectratio", "aria-label", "style"]);
const SVG_CASE: Record<string, string> = { viewbox: "viewBox", gradienttransform: "gradientTransform", gradientunits: "gradientUnits", preserveaspectratio: "preserveAspectRatio" };

/** Inline CSS properties a slide may use. */
const CSS_PROPS = new Set([
  "position", "left", "top", "right", "bottom", "width", "height", "min-width", "min-height", "max-width", "max-height", "inset",
  "display", "flex-direction", "flex-wrap", "gap", "row-gap", "column-gap", "align-items", "align-content", "justify-content", "align-self", "justify-items", "justify-self", "order",
  "flex", "flex-grow", "flex-shrink", "flex-basis", "grid-template-columns", "grid-template-rows", "grid-column", "grid-row", "aspect-ratio",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left", "margin-inline", "margin-block",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left", "padding-inline", "padding-block",
  "overflow", "box-sizing", "direction", "unicode-bidi", "vertical-align", "list-style", "list-style-type", "list-style-position",
  "font-family", "font-size", "font-weight", "font-style", "font", "line-height", "letter-spacing", "word-spacing", "text-align", "text-transform", "white-space", "text-decoration", "text-indent", "font-variant-numeric", "-webkit-text-stroke", "text-wrap",
  "color", "background", "background-color", "background-image", "background-size", "background-position", "background-repeat", "background-clip", "-webkit-background-clip", "-webkit-text-fill-color",
  "border", "border-top", "border-right", "border-bottom", "border-left", "border-color", "border-width", "border-style", "border-radius", "border-collapse", "border-spacing", "outline",
  "box-shadow", "text-shadow", "opacity", "transform", "transform-origin", "filter", "backdrop-filter", "mix-blend-mode", "z-index",
  "object-fit", "object-position", "fill", "stroke", "stroke-width", "stop-color", "stop-opacity",
]);
const BAD_VALUE = /url\s*\(|expression|javascript:|vbscript:|@import|\\|<|>|\/\*|behaviou?r|-moz-binding|attr\s*\(|var\s*\(|env\s*\(/i;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 && !(n >= 0xd800 && n < 0xe000) ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
const escText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s: string) => escText(s).replace(/"/g, "&quot;");

/** A picture of the deck: `img:` + a storage path (no `..`, no scheme). */
export const IMG_TOKEN = /^img:[A-Za-z0-9_\-./]{3,400}$/;
const okImg = (v: string) => IMG_TOKEN.test(v) && !v.includes("..");

/** Inline style → only the allowed properties, with safe values. */
export function sanitizeStyle(style: string): string {
  const out: string[] = [];
  for (const decl of decodeEntities(style).split(";")) {
    const i = decl.indexOf(":");
    if (i < 1) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    let value = decl.slice(i + 1).trim().replace(/\s*!important\s*$/i, "");
    if (!CSS_PROPS.has(prop) || !value || value.length > 600 || BAD_VALUE.test(value)) continue;
    // a slide never covers the page it is shown in
    if (prop === "position" && !/^(absolute|relative|static)$/i.test(value)) continue;
    if (prop === "z-index") value = String(Math.max(-5, Math.min(50, parseInt(value, 10) || 0)));
    out.push(`${prop}:${value.replace(/"/g, "'")}`);
  }
  return out.join(";");
}

function svgAttr(name: string, value: string): string | null {
  if (!SVG_ATTRS.has(name)) return null;
  const v = decodeEntities(value).trim();
  if (name === "style") return sanitizeStyle(v) || null;
  if (name === "fill" || name === "stroke") return /^url\(#[A-Za-z0-9_-]{1,40}\)$/.test(v) || !/[()<>\\]|url/i.test(v) || /^(rgba?|hsla?)\([0-9.,%\s]+\)$/i.test(v) ? v : null;
  if (name === "id") return /^[A-Za-z][A-Za-z0-9_-]{0,40}$/.test(v) ? v : null;
  if (/url|javascript|expression|[<>\\]/i.test(v) || v.length > 8000) return null;
  return v;
}

interface Tok { kind: "text" | "open" | "close"; name?: string; attrs?: [string, string][]; self?: boolean; text?: string }

/** A forgiving tokenizer: tags with quoted / unquoted attributes, text, comments skipped. */
function tokenize(html: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      toks.push({ kind: "text", text: html.slice(i) });
      break;
    }
    if (lt > i) toks.push({ kind: "text", text: html.slice(i, lt) });
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (html[lt + 1] === "!" || html[lt + 1] === "?") {
      const end = html.indexOf(">", lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    const close = html[lt + 1] === "/";
    const m = /^[A-Za-z][A-Za-z0-9-]*/.exec(html.slice(lt + (close ? 2 : 1), lt + 40));
    if (!m) {
      toks.push({ kind: "text", text: "<" });
      i = lt + 1;
      continue;
    }
    const name = m[0].toLowerCase();
    let j = lt + (close ? 2 : 1) + m[0].length;
    const attrs: [string, string][] = [];
    let self = false;
    while (j < n && html[j] !== ">") {
      const c = html[j];
      if (/\s/.test(c)) {
        j++;
        continue;
      }
      if (c === "/") {
        self = true;
        j++;
        continue;
      }
      const am = /^[^\s=>/"']+/.exec(html.slice(j, j + 200));
      if (!am) {
        j++;
        continue;
      }
      const an = am[0].toLowerCase();
      j += am[0].length;
      while (j < n && /\s/.test(html[j])) j++;
      let av = "";
      if (html[j] === "=") {
        j++;
        while (j < n && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const e = html.indexOf(q, j + 1);
          av = html.slice(j + 1, e < 0 ? n : e);
          j = e < 0 ? n : e + 1;
        } else {
          const um = /^[^\s>]*/.exec(html.slice(j));
          av = um ? um[0] : "";
          j += av.length;
        }
      }
      self = false;
      attrs.push([an, av]);
    }
    i = j + 1;
    toks.push(close ? { kind: "close", name } : { kind: "open", name, attrs, self });
  }
  return toks;
}

/**
 * One slide's markup → the safe slide: exactly one <section data-slide="id"> (the first section's style kept, or a
 * section added around whatever came), only the allowed tags, attributes and styles, pictures only as img: tokens.
 */
export function sanitizeSlide(html: string, id: string): string {
  const toks = tokenize(String(html ?? "").slice(0, MAX_HTML * 2));
  const out: string[] = [];
  const stack: string[] = [];
  let sectionStyle = "";
  let sawSection = false;
  let skip: string | null = null;
  let skipDepth = 0;
  let count = 0;
  let svgDepth = 0;
  for (const t of toks) {
    if (skip) {
      if (t.kind === "open" && t.name === skip && !t.self) skipDepth++;
      if (t.kind === "close" && t.name === skip && --skipDepth <= 0) skip = null;
      continue;
    }
    if (t.kind === "text") {
      if (svgDepth) continue;
      out.push(escText(decodeEntities(t.text!)));
      continue;
    }
    const name = t.name!;
    if (t.kind === "open" && DROP_ALL.has(name)) {
      if (!t.self && !VOID.has(name)) {
        skip = name;
        skipDepth = 1;
      }
      continue;
    }
    if (name === "section") {
      // the slide's own section: its style is kept for the one wrapper; any further section is just a box
      if (t.kind === "open" && !sawSection && stack.length === 0) {
        sawSection = true;
        sectionStyle = sanitizeStyle(t.attrs!.find(([k]) => k === "style")?.[1] ?? "");
        continue;
      }
      if (t.kind === "close" && !stack.length) continue;
    }
    const svgName = SVG_TAGS[name];
    const inSvg = svgDepth > 0 || name === "svg";
    const allowed = inSvg ? Boolean(svgName) : HTML_TAGS.has(name) || name === "section";
    if (!allowed) continue;
    const tag = inSvg ? svgName : name === "section" ? "div" : name === "strong" ? "b" : name === "em" ? "i" : name;
    if (t.kind === "close") {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      while (stack.length > at) {
        const top = stack.pop()!;
        if (top === "svg") svgDepth--;
        out.push(`</${top}>`);
      }
      continue;
    }
    if (++count > MAX_ELEMENTS) break;
    const attrs: string[] = [];
    for (const [k, v] of t.attrs!) {
      if (k.startsWith("on")) continue;
      if (inSvg) {
        const ok = svgAttr(k, v);
        if (ok !== null) attrs.push(`${SVG_CASE[k] ?? k}="${escAttr(ok)}"`);
        continue;
      }
      if (k === "style") {
        const s = sanitizeStyle(v);
        if (s) attrs.push(`style="${escAttr(s)}"`);
      } else if (k === "alt" && tag === "img") attrs.push(`alt="${escAttr(decodeEntities(v).slice(0, 300))}"`);
      else if (k === "src" && tag === "img") {
        const src = decodeEntities(v).trim();
        if (okImg(src)) attrs.push(`src="${escAttr(src)}"`);
      } else if (k === "dir" && /^(rtl|ltr|auto)$/i.test(v)) attrs.push(`dir="${v.toLowerCase()}"`);
    }
    // a picture without a picture of the deck is dropped
    if (tag === "img" && !attrs.some((a) => a.startsWith("src="))) continue;
    const selfClose = VOID.has(tag) || (inSvg && t.self);
    out.push(`<${tag}${attrs.length ? " " + attrs.join(" ") : ""}${inSvg && t.self ? "/" : ""}>`);
    if (!selfClose) {
      stack.push(tag);
      if (tag === "svg") svgDepth++;
    }
  }
  while (stack.length) out.push(`</${stack.pop()}>`);
  const body = out.join("").slice(0, MAX_HTML);
  return `<section data-slide="${escAttr(String(id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "s")}"${sectionStyle ? ` style="${escAttr(sectionStyle)}"` : ""}>${body}</section>`;
}

/** The plain text of a slide (search, the speaker view, checks). */
export const slideText = (html: string) => decodeEntities(html.replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Every picture token a deck uses. */
export function deckImages(deck: Deck): string[] {
  const set = new Set<string>();
  for (const s of deck.slides) for (const m of s.html.matchAll(/src="img:([^"]+)"/g)) set.add(m[1]);
  return [...set];
}

/** The tokens swapped for real addresses (signed links in the browser, data: URIs on the server). */
export function resolveImages(html: string, resolve: (path: string) => string | undefined) {
  return html.replace(/src="img:([^"]+)"/g, (m, p: string) => {
    const url = resolve(p);
    return url ? `src="${escAttr(url)}" data-token="${escAttr(p)}"` : `src="data:," data-missing="1" data-token="${escAttr(p)}"`;
  });
}

/** The CSS every view of a deck shares: the canvas, right-to-left, the fonts' defaults. */
export function baseCss(aspect: DeckAspect, fontFamily: string) {
  const { w, h } = DECK_SIZE[aspect];
  return `*{box-sizing:border-box;margin:0;padding:0}html,body{background:transparent}body{direction:rtl;font-family:${fontFamily};-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
section[data-slide]{position:relative;width:${w}px;height:${h}px;overflow:hidden;display:block;background:#ffffff;color:#1a1a1a;direction:rtl;text-align:right}
section[data-slide] img{display:block}
section[data-slide] ul,section[data-slide] ol{padding-inline-start:1.2em}
section[data-slide] li{margin-bottom:.25em}
section[data-slide] table{border-collapse:collapse}
section[data-slide] p,section[data-slide] h1,section[data-slide] h2,section[data-slide] h3,section[data-slide] li{overflow-wrap:break-word}`;
}

/** A whole HTML page with the given slides: one page per slide when printed. */
export function deckDocument(deck: Deck, o: { fontCss: string; resolve: (path: string) => string | undefined; only?: number[]; print?: boolean; csp?: boolean; extraCss?: string }) {
  const { w, h } = DECK_SIZE[deck.aspect];
  const slides = deck.slides.filter((_, i) => !o.only || o.only.includes(i));
  const csp = o.csp ? `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https: http:; style-src 'unsafe-inline'; font-src data: https: http:">` : "";
  // a printed page is its real paper size: the 192 dpi canvas is zoomed to 96 dpi CSS pixels (A4 = 794 × 1123 px)
  const paper = DECK_PAPER[deck.aspect];
  const print = o.print
    ? paper
      ? `@page{size:${paper.w}mm ${paper.h}mm;margin:0}html{zoom:${PRINT_ZOOM}}section[data-slide]{break-after:page;page-break-after:always}section[data-slide]:last-child{break-after:auto;page-break-after:auto}`
      : `@page{size:${w}px ${h}px;margin:0}section[data-slide]{break-after:page;page-break-after:always}section[data-slide]:last-child{break-after:auto;page-break-after:auto}`
    : "";
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">${csp}<style>${o.fontCss}\n${baseCss(deck.aspect, deckFontStack(deck))}${print}${o.extraCss ?? ""}</style></head><body>${slides.map((s) => resolveImages(s.html, o.resolve)).join("")}</body></html>`;
}

/** The family names of a deck's fonts (from the site's list), as a CSS stack. */
export let fontFamilyOf: (id: string) => string = (id) => id;
export const setFontFamilyLookup = (f: (id: string) => string) => {
  fontFamilyOf = f;
};
export const deckFontStack = (deck: Deck) => [...deck.fonts.map((id) => `"${fontFamilyOf(id)}"`), "Tahoma", "sans-serif"].join(",");

/**
 * Run inside a page that shows the slides: what is wrong with each one, measured — text past the slide's edge, text
 * cut off in its box, text too small to read. Returns `[slideIndex, problem][]`.
 */
export const MEASURE_SCRIPT = `(() => {
  const out = [];
  const secs = [...document.querySelectorAll("section[data-slide]")];
  secs.forEach((sec, si) => {
    const R = sec.getBoundingClientRect();
    const seen = new Set();
    for (const el of sec.querySelectorAll("h1,h2,h3,p,li,td,th,span,div,img,svg")) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const label = (el.textContent || el.getAttribute("alt") || el.tagName).trim().replace(/\\s+/g, " ").slice(0, 40);
      const past = Math.max(R.left - r.left, r.right - R.right, R.top - r.top, r.bottom - R.bottom);
      if ((own || el.tagName === "IMG") && past > 6 && !seen.has(label)) {
        seen.add(label);
        out.push([si, '"' + label + '" goes ' + Math.round(past) + 'px past the edge of the slide']);
      }
      if (own && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3) && cs.overflow !== "visible" && el.clientHeight > 0) {
        out.push([si, '"' + label + '" is cut off inside its box (' + el.scrollHeight + 'px of text in ' + el.clientHeight + 'px)']);
      }
      if (own && parseFloat(cs.fontSize) < 20) out.push([si, '"' + label + '" is ' + parseFloat(cs.fontSize) + 'px (under 20px: too small to read)']);
    }
    for (const img of sec.querySelectorAll("img[data-missing]")) out.push([si, "a picture is missing (" + (img.getAttribute("alt") || "no alt") + ")"]);
  });
  return out;
})()`;

/** A short stable signature (FNV-1a) of anything JSON can hold. */
export function sigOf(v: unknown): string {
  const s = JSON.stringify(v) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** A deck read from storage or a request: only the known shape, every slide sanitized again. */
export function readDeck(v: unknown): Deck | null {
  const d = (v && typeof v === "object" ? v : null) as Partial<Deck> | null;
  if (!d || !Array.isArray(d.slides)) return null;
  const aspect: DeckAspect = d.aspect === "4:3" || d.aspect === "a4" || d.aspect === "a4l" ? d.aspect : "16:9";
  const ids = new Set<string>();
  const slides = d.slides.slice(0, 120).map((s, i) => {
    let id = String((s as DeckSlide)?.id ?? "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || `s${i + 1}`;
    while (ids.has(id)) id = `${id}x`;
    ids.add(id);
    const x = s as DeckSlide;
    return { id, html: sanitizeSlide(String(x?.html ?? ""), id), notes: String(x?.notes ?? "").slice(0, 4000), ...(x?.sig ? { sig: String(x.sig).slice(0, 40) } : {}), ...(x?.edited ? { edited: true } : {}) };
  });
  const fonts = (Array.isArray(d.fonts) ? d.fonts : []).map(String).filter((f) => /^[a-z0-9-]{2,30}$/.test(f)).slice(0, 4);
  return { v: 1, title: String(d.title ?? "").slice(0, 200), aspect, fonts, slides };
}
