// «الطالب الذكي» — files on the server: fonts embedded as data, Chromium printing HTML to PDF (real text, embedded
// fonts, correct Arabic shaping), and PPTX built with pptxgenjs from the same slide plan. Server only.

import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { Browser } from "puppeteer-core";
import { fontById, type Design } from "@config/jawad/student";
import type { SlidePlan } from "../model";
import { colorsOf, styleFor } from "./css";
import { FIT_SCRIPT, SLIDE_SIZE, slidesHtml, type RenderOpts } from "./html";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

/** @font-face rules with the font files inlined (the PDF embeds them). */
export async function fontFacesData(ids: string[]) {
  const rules: string[] = [];
  for (const id of [...new Set(ids)]) {
    const f = fontById(id);
    for (const file of f.files) {
      const b64 = (await readFile(path.join(FONT_DIR, file.file))).toString("base64");
      rules.push(`@font-face{font-family:"${f.family}";src:url(data:font/ttf;base64,${b64}) format("truetype");font-weight:${file.weight};font-display:block}`);
    }
  }
  return rules.join("\n");
}

export const designFonts = (d: Design) => [d.fonts.heading, d.fonts.body, d.fonts.accent, "amiri"];

function localChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const root = "/opt/pw-browsers";
  if (existsSync(root)) {
    for (const d of readdirSync(root)) {
      for (const p of [`${root}/${d}/chrome-linux/chrome`, `${root}/${d}/chrome-linux64/chrome`]) if (existsSync(p)) return p;
    }
  }
  return null;
}

async function browser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  const local = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME ? null : localChrome();
  if (local) return puppeteer.launch({ executablePath: local, headless: true, args: ["--no-sandbox", "--font-render-hinting=none"] });
  const chromium = (await import("@sparticuz/chromium")).default;
  return puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: chromium.args });
}

/** HTML → PDF. Page numbers in the footer when asked. */
export async function htmlToPdf(html: string, o: { numbered?: boolean; slides?: boolean } = {}) {
  const b = await browser();
  try {
    const page = await b.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 120_000 });
    await page.evaluate("document.fonts.ready");
    let fit: [number, number, boolean][] = [];
    if (o.slides) fit = (await page.evaluate(FIT_SCRIPT)) as [number, number, boolean][];
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: Boolean(o.numbered),
      headerTemplate: "<span></span>",
      footerTemplate: o.numbered ? FOOTER : "<span></span>",
      timeout: 240_000,
    });
    // A PDF that came out empty is a failure, never "done"
    if (pdf.length < 1000) throw new Error("empty PDF");
    return { pdf: Buffer.from(pdf), fit };
  } finally {
    await b.close();
  }
}

const FOOTER = `<div style="width:100%;text-align:center;font-size:9px;color:#777;font-family:sans-serif"><span class="pageNumber"></span></div>`;

/**
 * A thin double frame drawn on every page of a printed PDF (the cover, when it has one, stays without): drawn on the
 * file itself so it sits exactly at the same place on each page, whatever the content does.
 */
export async function framePdf(pdf: Buffer, o: { color: string; size: "A4" | "A5"; skipFirst: boolean }) {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const n = parseInt(o.color.replace("#", "").slice(0, 6), 16);
  const color = rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
  const mm = 72 / 25.4;
  const side = (o.size === "A4" ? 10 : 7) * mm;
  const top = (o.size === "A4" ? 10 : 7) * mm;
  // the page number sits under the frame, in the bottom margin
  const bottom = (o.size === "A4" ? 13 : 10) * mm;
  doc.getPages().forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const { width, height } = page.getSize();
    page.drawRectangle({ x: side, y: bottom, width: width - 2 * side, height: height - top - bottom, borderColor: color, borderWidth: 0.9, opacity: 0, borderOpacity: 0.85 });
    const g = 2.6;
    page.drawRectangle({ x: side + g, y: bottom + g, width: width - 2 * side - 2 * g, height: height - top - bottom - 2 * g, borderColor: color, borderWidth: 0.35, opacity: 0, borderOpacity: 0.45 });
  });
  return Buffer.from(await doc.save());
}

/** Pages of a PDF. */
export async function pdfPageCount(pdf: Buffer) {
  const { PDFDocument } = await import("pdf-lib");
  return (await PDFDocument.load(pdf, { ignoreEncryption: true })).getPageCount();
}

/**
 * A document printed to exactly `want` pages when the type can get it there: the type scale is bisected between
 * FIT_SCALE.min and .max (one browser, a few prints). Returns the closest print and how many pages it has.
 */
export async function fitPdf(make: (scale: number) => string, want: number, o: { numbered?: boolean } = {}) {
  const { FIT_SCALE, nextScale } = await import("../pages");
  const b = await browser();
  try {
    const page = await b.newPage();
    const print = async (scale: number) => {
      await page.setContent(make(scale), { waitUntil: "load", timeout: 120_000 });
      await page.evaluate("document.fonts.ready");
      const pdf = Buffer.from(
        await page.pdf({ printBackground: true, preferCSSPageSize: true, displayHeaderFooter: Boolean(o.numbered), headerTemplate: "<span></span>", footerTemplate: o.numbered ? FOOTER : "<span></span>", timeout: 240_000 }),
      );
      if (pdf.length < 1000) throw new Error("empty PDF");
      return { pdf, pages: await pdfPageCount(pdf), scale };
    };
    let best = await print(1);
    const better = (x: typeof best) => {
      const d = Math.abs(x.pages - want) - Math.abs(best.pages - want);
      // as close as the best, and nearer the normal size
      if (d < 0 || (d === 0 && Math.abs(x.scale - 1) < Math.abs(best.scale - 1))) best = x;
    };
    if (best.pages === want) return best;
    // too many pages: smaller type (down to min); too few: bigger (up to max)
    let lo = best.pages > want ? FIT_SCALE.min : 1;
    let hi = best.pages > want ? 1 : FIT_SCALE.max;
    // the limit first: if even it misses, there is nothing to bisect
    const edge = await print(best.pages > want ? lo : hi);
    better(edge);
    if ((best.pages > want && edge.pages > want) || (best.pages < want && edge.pages < want)) return best;
    for (let i = 0; i < 6; i++) {
      const mid = nextScale(lo, hi);
      if (mid === null) break;
      const r = await print(mid);
      better(r);
      if (r.pages === want) return r;
      if (r.pages > want) hi = mid;
      else lo = mid;
    }
    return best;
  } finally {
    await b.close();
  }
}

/** Slides → PDF and the text sizes that fit each slide (reused for the PPTX). */
export async function slidesPdf(plan: SlidePlan, design: Design, o: RenderOpts & { aspect: "16:9" | "4:3"; only?: number[] }) {
  const { pdf, fit } = await htmlToPdf(slidesHtml(plan, design, o), { slides: true });
  return { pdf, fit };
}

const hex = (c: string) => c.replace("#", "").slice(0, 6).toUpperCase();

/** An editable PPTX (right-to-left text, the chosen fonts by name, speaker notes). */
export async function slidesPptx(plan: SlidePlan, design: Design, o: { aspect: "16:9" | "4:3"; fit: [number, number, boolean][]; images: Record<string, Buffer>; only?: number[] }) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = o.aspect === "16:9" ? "LAYOUT_16x9" : "LAYOUT_4x3";
  pptx.rtlMode = true;
  pptx.title = plan.title;
  const W = o.aspect === "16:9" ? 10 : 10;
  const H = o.aspect === "16:9" ? 5.625 : 7.5;
  const px = SLIDE_SIZE[o.aspect].w / W; // CSS px per inch of the PPTX page
  const head = fontById(design.fonts.heading).family;
  const body = fontById(design.fonts.body).family;
  const accent = fontById(design.fonts.accent).family;

  plan.slides.forEach((s, i) => {
    if (o.only && !o.only.includes(i)) return;
    const st = s.layout === "cards" || s.layout === "compare" ? styleFor(design, "compare") : s.layout === "title" || s.layout === "section" ? styleFor(design, i === 0 ? "cover" : "story") : design.main;
    const c = colorsOf(design, st);
    const slide = pptx.addSlide();
    slide.background = { color: hex(c.paper) };
    const fitPx = o.fit.find((f) => f[0] === i)?.[1] ?? 30;
    // the HTML slide is `px` CSS pixels per PPTX inch, so a fitted size of n px is n / px inches = n × 72 / px points
    const pt = Math.max(12, Math.round((fitPx * 72) / px));
    const base = { rtlMode: true, align: "right" as const, fontFace: body, color: hex(c.ink), valign: "top" as const };
    const big = s.layout === "title" || s.layout === "section";
    slide.addText(s.title, { ...base, x: 0.6, y: big ? H / 2 - 1 : 0.4, w: W - 1.2, h: big ? 1.2 : 0.9, fontFace: head, fontSize: big ? 40 : 30, bold: true, color: hex(c.accent), valign: "middle" });
    const items = s.text.filter(Boolean);
    const top = big ? H / 2 + 0.3 : 1.45;
    const boxH = H - top - 0.5;
    if (s.layout === "cards") {
      const n = Math.max(1, items.length);
      const cols = Math.min(3, n);
      const rows = Math.ceil(n / cols);
      const cw = (W - 1.2 - (cols - 1) * 0.2) / cols;
      const ch = (boxH - (rows - 1) * 0.2) / rows;
      items.forEach((t, k) => {
        const col = k % cols;
        const row = Math.floor(k / cols);
        const x = W - 0.6 - (col + 1) * cw - col * 0.2; // right to left
        const [a, ...b] = t.split(":");
        slide.addShape(pptx.ShapeType.roundRect, { x, y: top + row * (ch + 0.2), w: cw, h: ch, fill: { color: hex(colorsOf(design, st).bg) }, line: { color: hex(c.line) }, rectRadius: 0.12 });
        slide.addText(
          b.length ? [{ text: `${a.trim()}\n`, options: { bold: true, color: hex(c.accent), fontFace: head } }, { text: b.join(":").trim() }] : [{ text: t }],
          { ...base, x: x + 0.1, y: top + row * (ch + 0.2) + 0.08, w: cw - 0.2, h: ch - 0.16, fontSize: Math.min(pt, 18) },
        );
      });
    } else if (s.layout === "compare") {
      const rows = items.map((r) => r.split("|").map((x) => x.trim()));
      if (rows.length) {
        slide.addTable(
          rows.map((r, k) => r.map((cell) => ({ text: cell, options: { bold: k === 0, fill: { color: hex(k === 0 ? c.line : c.paper) }, fontFace: k === 0 ? head : body, rtlMode: true, align: "right" as const } }))),
          { x: 0.6, y: top, w: W - 1.2, fontSize: Math.min(pt, 16), color: hex(c.ink), border: { type: "solid", color: hex(c.line), pt: 1 } },
        );
      }
    } else if (s.layout === "quote") {
      slide.addText(items.join("\n"), { ...base, x: 1, y: top, w: W - 2, h: boxH, fontFace: accent, fontSize: Math.min(pt + 4, 32), align: "center", valign: "middle" });
    } else if (s.layout === "image" && s.image.path && o.images[s.image.path]) {
      const img = o.images[s.image.path];
      slide.addImage({ data: `data:image/png;base64,${img.toString("base64")}`, x: 0.6, y: top, w: (W - 1.2) * 0.45, h: boxH, sizing: { type: "contain", w: (W - 1.2) * 0.45, h: boxH } });
      slide.addText(items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })), { ...base, x: 0.6 + (W - 1.2) * 0.5, y: top, w: (W - 1.2) * 0.5, h: boxH, fontSize: pt });
    } else if (items.length) {
      slide.addText(
        big ? [{ text: items.join(" · ") }] : items.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
        { ...base, x: 0.6, y: top, w: W - 1.2, h: boxH, fontSize: big ? 20 : pt, color: hex(big ? c.muted : c.ink) },
      );
    }
    slide.addText(String(i + 1), { x: 0.2, y: H - 0.4, w: 0.6, h: 0.3, fontSize: 10, color: hex(c.muted), align: "left" });
    if (s.notes) slide.addNotes(s.notes);
  });
  const out = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  if (out.length < 2000) throw new Error("empty PPTX");
  return out;
}
