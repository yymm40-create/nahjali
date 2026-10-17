// «مصمم العروض» — a deck on the server: its slides drawn as pictures (for Claude to look at), measured (what is cut
// off or past the edge), printed to PDF (the same look, real text, the fonts embedded), and turned into an editable
// PPTX: every text box and picture becomes its own PowerPoint object at the same place and size (text you can edit,
// pictures you can swap), and what is only decoration (backgrounds, gradients, shapes, drawings) is laid under them as
// one picture of the slide without its text. Server only.

import { FONTS, fontById } from "@config/jawad/student";
import { fontFacesData, htmlToPdf, htmlToPngs, openBrowser } from "@/lib/jawad/student/render/server";
import { DECK_SIZE, deckDocument, MEASURE_SCRIPT, setFontFamilyLookup, type Deck } from "./format";

setFontFamilyLookup((id) => fontById(id).family);

/** The deck's fonts, always with a readable Arabic body and the Quran's naskh behind them. */
export const deckFontIds = (deck: Deck) => [...new Set([...deck.fonts.filter((f) => FONTS.some((x) => x.id === f)), "plex", "amiri"])];

type Resolve = (path: string) => string | undefined;

/** Each slide (or the ones asked) as a PNG; `scale` 0.5 = 960×540 for a 16:9 slide. */
export async function deckPngs(deck: Deck, resolve: Resolve, o: { only?: number[]; scale?: number } = {}) {
  const { w, h } = DECK_SIZE[deck.aspect];
  const fontCss = await fontFacesData(deckFontIds(deck));
  const idx = deck.slides.map((_, i) => i).filter((i) => !o.only || o.only.includes(i));
  const pngs = await htmlToPngs(idx.map((i) => ({ html: deckDocument(deck, { fontCss, resolve, only: [i] }), w, h, scale: o.scale ?? 0.5 })));
  return idx.map((i, k) => ({ index: i, png: pngs[k] }));
}

/** What is wrong with each slide, measured in a real browser: `[slideIndex, problem]`. */
export async function measureDeck(deck: Deck, resolve: Resolve, only?: number[]): Promise<[number, string][]> {
  const { w, h } = DECK_SIZE[deck.aspect];
  const fontCss = await fontFacesData(deckFontIds(deck));
  const b = await openBrowser();
  try {
    const page = await b.newPage();
    await page.setViewport({ width: w, height: h });
    await page.setContent(deckDocument(deck, { fontCss, resolve, only }), { waitUntil: "load", timeout: 120_000 });
    await page.evaluate("document.fonts.ready");
    const found = (await page.evaluate(MEASURE_SCRIPT)) as [number, string][];
    // the indexes come back within the slides shown: mapped to the deck's own
    const map = deck.slides.map((_, i) => i).filter((i) => !only || only.includes(i));
    return found.map(([i, m]) => [map[i] ?? i, m]);
  } finally {
    await b.close();
  }
}

/** The deck as a PDF: one page per slide at the slide's own size. */
export async function deckPdf(deck: Deck, resolve: Resolve) {
  const fontCss = await fontFacesData(deckFontIds(deck));
  const { pdf } = await htmlToPdf(deckDocument(deck, { fontCss, resolve, print: true }));
  return pdf;
}

interface Run { text: string; bold: boolean; italic: boolean; underline: boolean; color: string; br?: boolean }
interface TextItem { kind: "text"; x: number; y: number; w: number; h: number; rot: number; font: string; size: number; color: string; bold: boolean; italic: boolean; align: string; lineHeight: number; bullet: boolean; runs: Run[] }
interface ImgItem { kind: "img"; x: number; y: number; w: number; h: number; rot: number; src: string; fit: string; opacity: number }

/**
 * Inside the page: slide `i`'s text boxes and pictures (in slide pixels, unrotated box + angle), then the text and the
 * pictures hidden so a screenshot of the slide keeps only the decoration under them.
 */
const EXTRACT = `(i) => {
  const sec = document.querySelectorAll("section[data-slide]")[i];
  const R = sec.getBoundingClientRect();
  const hex = (c) => { const m = /rgba?\\(([^)]+)\\)/.exec(c || ""); if (!m) return "000000"; const p = m[1].split(",").map((x) => parseFloat(x)); return p.slice(0, 3).map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase(); };
  const angle = (el) => { const t = getComputedStyle(el).transform; if (!t || t === "none") return 0; const m = /matrix\\(([^)]+)\\)/.exec(t); if (!m) return 0; const [a, b] = m[1].split(",").map(parseFloat); return Math.round(Math.atan2(b, a) * 180 / Math.PI); };
  const box = (el) => { const r = el.getBoundingClientRect(); const w = el.offsetWidth || r.width, h = el.offsetHeight || r.height; return { x: r.left + r.width / 2 - w / 2 - R.left, y: r.top + r.height / 2 - h / 2 - R.top, w, h }; };
  const BLOCK = new Set(["H1","H2","H3","P","LI","TD","TH"]);
  const isBlock = (el) => BLOCK.has(el.tagName) || (el.tagName === "DIV" && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const items = [];
  const blocks = [...sec.querySelectorAll("h1,h2,h3,p,li,td,th,div")].filter((el) => isBlock(el) && !el.closest("svg") && !(el.parentElement && el.parentElement.closest("h1,h2,h3,p,li,td,th")) && el.textContent.trim());
  for (const el of blocks) {
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
    const runs = [];
    const walk = (n, st) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) { const t = c.textContent.replace(/\\s+/g, " "); if (t) runs.push({ text: t, ...st }); continue; }
        if (c.nodeType !== 1) continue;
        if (c.tagName === "BR") { runs.push({ text: "", br: true, ...st }); continue; }
        if (c.tagName === "IMG" || c.tagName === "svg") continue;
        if (isBlock(c) && c !== el) continue;
        const s = getComputedStyle(c);
        walk(c, { bold: parseInt(s.fontWeight) >= 600, italic: s.fontStyle === "italic", underline: s.textDecorationLine.includes("underline"), color: hex(s.webkitTextFillColor && s.webkitTextFillColor !== s.color && !/rgba\\(0, 0, 0, 0\\)/.test(s.webkitTextFillColor) ? s.webkitTextFillColor : s.color) });
      }
    };
    walk(el, { bold: parseInt(cs.fontWeight) >= 600, italic: cs.fontStyle === "italic", underline: cs.textDecorationLine.includes("underline"), color: hex(cs.color) });
    if (runs.length) { runs[0].text = runs[0].text.replace(/^\\s+/, ""); const l = runs[runs.length - 1]; l.text = l.text.replace(/\\s+$/, ""); }
    const b = box(el);
    const lh = cs.lineHeight === "normal" ? parseFloat(cs.fontSize) * 1.3 : parseFloat(cs.lineHeight);
    const align = cs.textAlign === "start" ? (cs.direction === "rtl" ? "right" : "left") : cs.textAlign === "end" ? (cs.direction === "rtl" ? "left" : "right") : cs.textAlign;
    items.push({ kind: "text", ...b, rot: angle(el), font: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(), size: parseFloat(cs.fontSize), color: hex(cs.color), bold: parseInt(cs.fontWeight) >= 600, italic: cs.fontStyle === "italic", align, lineHeight: lh, bullet: el.tagName === "LI", runs });
  }
  for (const img of sec.querySelectorAll("img")) {
    const cs = getComputedStyle(img);
    if (cs.visibility === "hidden" || cs.display === "none" || !img.src.startsWith("data:image")) continue;
    items.push({ kind: "img", ...box(img), rot: angle(img), src: img.src, fit: cs.objectFit, opacity: Number(cs.opacity) });
  }
  const st = document.createElement("style");
  st.textContent = 'section[data-slide] h1,section[data-slide] h2,section[data-slide] h3,section[data-slide] p,section[data-slide] li,section[data-slide] td,section[data-slide] th,section[data-slide] span,section[data-slide] b,section[data-slide] i,section[data-slide] u,section[data-slide] div{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}section[data-slide] li::marker{color:transparent!important}section[data-slide] img{visibility:hidden!important}';
  document.head.appendChild(st);
  return { items, top: R.top + window.scrollY };
}`;

/** An editable PPTX of the deck (right-to-left text boxes, the fonts by name, pictures, speaker notes). */
export async function deckPptx(deck: Deck, resolve: Resolve) {
  const { w, h } = DECK_SIZE[deck.aspect];
  const fontCss = await fontFacesData(deckFontIds(deck));
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  // 144 slide pixels to the inch: 1920 px = 13.33 in (PowerPoint's wide page); 1 px = 0.5 pt
  const IN = 144;
  pptx.defineLayout({ name: "DECK", width: w / IN, height: h / IN });
  pptx.layout = "DECK";
  pptx.rtlMode = true;
  pptx.title = deck.title;
  const b = await openBrowser();
  try {
    for (let i = 0; i < deck.slides.length; i++) {
      // one page per slide: what is hidden for the background picture of one never touches another
      const page = await b.newPage();
      await page.setViewport({ width: w, height: h });
      await page.setContent(deckDocument(deck, { fontCss, resolve, only: [i] }), { waitUntil: "load", timeout: 120_000 });
      await page.evaluate("document.fonts.ready");
      const r = (await page.evaluate(`(${EXTRACT})(0)`)) as { items: (TextItem | ImgItem)[]; top: number };
      const bg = Buffer.from(await page.screenshot({ type: "png", clip: { x: 0, y: r.top, width: w, height: h } }));
      await page.close();
      const slide = pptx.addSlide();
      slide.addImage({ data: `data:image/png;base64,${bg.toString("base64")}`, x: 0, y: 0, w: w / IN, h: h / IN });
      for (const it of r.items) {
        const pos = { x: it.x / IN, y: it.y / IN, w: Math.max(0.05, it.w / IN), h: Math.max(0.05, it.h / IN), ...(it.rot ? { rotate: it.rot } : {}) };
        if (it.kind === "img") {
          slide.addImage({ data: it.src, ...pos, sizing: { type: it.fit === "contain" ? "contain" : "cover", w: pos.w, h: pos.h }, ...(it.opacity < 1 ? { transparency: Math.round((1 - it.opacity) * 100) } : {}) });
          continue;
        }
        const runs = it.runs.filter((x) => x.text || x.br);
        if (!runs.length) continue;
        const parts = runs.map((x, k) => ({
          text: x.br ? "" : x.text,
          options: { bold: x.bold, italic: x.italic, underline: x.underline ? { style: "sng" as const } : undefined, color: x.color, ...(x.br || runs[k + 1]?.br ? { breakLine: true } : {}) },
        }));
        slide.addText(parts, {
          ...pos,
          fontFace: it.font,
          fontSize: Math.max(6, Math.round(it.size / 2)),
          color: it.color,
          bold: it.bold,
          italic: it.italic,
          align: (["left", "center", "right", "justify"].includes(it.align) ? it.align : "right") as "left" | "center" | "right" | "justify",
          valign: "top",
          rtlMode: true,
          margin: 0,
          lineSpacing: Math.max(6, Math.round(it.lineHeight / 2)),
          bullet: it.bullet,
          fit: "none",
          wrap: true,
        });
      }
      if (deck.slides[i].notes) slide.addNotes(deck.slides[i].notes);
    }
  } finally {
    await b.close();
  }
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  if (out.length < 2000) throw new Error("empty PPTX");
  return out;
}
