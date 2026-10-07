// «الطالب الذكي» — a written output as a Word file (DOCX) the student can edit: right-to-left, the design's fonts
// (embedded) and colours, Word's own styles for the levels (العنوان = Title, العنوان الفرعي = Subtitle, chapters =
// Heading 1, sub-headings = Heading 2, card / table titles = Heading 3, body = Normal), margins, a thin frame on every
// page (unless the student turned it off) and page numbers. Same content as the PDF. Server only.

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { fontById, type Design } from "@config/jawad/student";
import type { Block, Doc } from "../model";
import { frontPages } from "../pages";
import { colorsOf } from "./css";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const hex = (c: string) => c.replace("#", "").slice(0, 6).toUpperCase();
const lum = (c: string) => {
  const n = parseInt(hex(c), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

/** Width × height of a PNG / JPEG (for the picture's proportions in Word). */
function imageSize(b: Buffer): { w: number; h: number; type: "png" | "jpg" } | null {
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), type: "png" };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const m = b[i + 1];
      const len = b.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7), type: "jpg" };
      i += 2 + len;
    }
  }
  return null;
}

/** «**bold**» and «==highlight==» from the writer as Word runs. */
function runs(s: string, base: IRunOptions = {}): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*(.+?)\*\*|==(.+?)==)/g;
  let at = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > at) out.push(new TextRun({ ...base, text: s.slice(at, m.index), rightToLeft: true }));
    if (m[2] !== undefined) out.push(new TextRun({ ...base, text: m[2], bold: true, boldComplexScript: true, rightToLeft: true }));
    else out.push(new TextRun({ ...base, text: m[3], highlight: "yellow", rightToLeft: true }));
    at = m.index + m[0].length;
  }
  if (at < s.length || !out.length) out.push(new TextRun({ ...base, text: s.slice(at), rightToLeft: true }));
  return out;
}

export interface DocxOpts {
  page: "A4" | "A5";
  /** the page count asked for: chapters flow on, cover and contents only when there is room (as in the PDF) */
  pages?: number;
  images?: Record<string, Buffer>;
  sources?: { url: string; title: string; accessedAt: string }[];
}

export async function docDocx(doc: Doc, design: Design, o: DocxOpts) {
  const c0 = colorsOf(design, design.main);
  // Word pages are white: a dark style keeps its accent on light paper
  const dark = lum(c0.paper) < 0.45;
  const c = dark ? { ...c0, paper: "#ffffff", ink: "#1b1f27", muted: "#5a6170", line: "#d5dae3" } : c0;
  const head = fontById(design.fonts.heading);
  const body = fontById(design.fonts.body);
  const accent = fontById(design.fonts.accent);
  const font = (f: typeof head) => ({ ascii: f.family, hAnsi: f.family, cs: f.family, eastAsia: f.family });
  const a4 = o.page !== "A5";
  const pt = a4 ? 12.5 : 11;
  const half = (n: number) => Math.round(n * 2);
  const fixed = (o.pages ?? 0) > 0;
  const front = fixed ? frontPages(o.pages!, doc.chapters.length) : { cover: true, toc: doc.chapters.length > 1 };

  const P = (children: ParagraphChild[], opts: Partial<ConstructorParameters<typeof Paragraph>[0] & object> = {}) => new Paragraph({ bidirectional: true, children, ...opts });
  const box = (fill: string, color: string) => ({
    shading: { type: ShadingType.CLEAR, fill: hex(fill), color: "auto" },
    border: { top: { style: BorderStyle.SINGLE, size: 6, color: hex(color), space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 6, color: hex(color), space: 4 }, left: { style: BorderStyle.SINGLE, size: 6, color: hex(color), space: 6 }, right: { style: BorderStyle.SINGLE, size: 6, color: hex(color), space: 6 } },
    spacing: { before: 120, after: 160 },
  });
  const tint = (col: string, k: number) => {
    const n = parseInt(hex(col), 16);
    const mix = (v: number) => Math.round(v + (255 - v) * (1 - k));
    return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, "0")).join("")}`;
  };

  function block(b: Block): (Paragraph | Table)[] {
    switch (b.t) {
      case "h":
        return [P(runs(b.text || b.title), { heading: HeadingLevel.HEADING_2 })];
      case "p":
        return [P(runs(b.text), { alignment: AlignmentType.BOTH })];
      case "list":
        return [
          ...(b.title ? [P(runs(b.title, { bold: true, boldComplexScript: true }))] : []),
          ...b.items.map((it) => P([...(it.title ? runs(`${it.title}: `, { bold: true, boldComplexScript: true }) : []), ...runs(it.text)], { numbering: { reference: "bullets", level: 0 } })),
          ...(b.text ? [P(runs(b.text), { alignment: AlignmentType.BOTH })] : []),
        ];
      case "note":
        return [P(runs(b.text, { color: hex(c.accent), font: font(accent) }), box(tint(c.accent2, 0.18), c.accent2))];
      case "term":
        return [P([...runs(`${b.title}: `, { bold: true, boldComplexScript: true, color: hex(c.accent), font: font(head) }), ...runs(b.text)], box(tint(c.accent, 0.07), c.accent))];
      case "quote":
        return [
          P(runs(b.text, { font: font(accent), size: half(pt * 1.12), sizeComplexScript: half(pt * 1.12) }), { indent: { start: 567, end: 567 }, spacing: { before: 160, after: b.title ? 40 : 160 } }),
          ...(b.title ? [P(runs(b.title, { color: hex(c.muted), size: half(pt * 0.8), sizeComplexScript: half(pt * 0.8) }), { indent: { start: 567 }, spacing: { after: 160 } })] : []),
        ];
      case "addition":
      case "research":
        return [
          P(runs(b.t === "addition" ? "إضافة من المساعد — ليست من المادة" : "من البحث الخارجي", { bold: true, boldComplexScript: true, color: hex(c.accent2), size: half(pt * 0.75), sizeComplexScript: half(pt * 0.75) }), { spacing: { before: 120, after: 0 } }),
          P([...runs(b.text), ...(b.sources.length ? [new TextRun({ text: ` ${b.sources.map((n) => `[${n + 1}]`).join("")}`, superScript: true, rightToLeft: true })] : [])], box(tint(c.accent2, 0.08), c.accent2)),
        ];
      case "cards":
      case "steps":
        return [
          ...(b.title ? [P(runs(b.title), { heading: HeadingLevel.HEADING_3 })] : []),
          ...b.items.map((it, i) =>
            P([...runs(`${b.t === "steps" ? `${(i + 1).toLocaleString("ar")}. ` : ""}${it.title}${it.text ? ": " : ""}`, { bold: true, boldComplexScript: true, color: hex(c.accent), font: font(head) }), ...runs(it.text)], box(c.paper === "#ffffff" ? tint(c.accent, 0.05) : c.paper, c.line)),
          ),
          ...(b.text ? [P(runs(b.text), { alignment: AlignmentType.BOTH })] : []),
        ];
      case "compare": {
        const rows = b.rows.filter((r) => r.length);
        const cols = Math.max(1, ...rows.map((r) => r.length));
        return [
          ...(b.title ? [P(runs(b.title), { heading: HeadingLevel.HEADING_3 })] : []),
          ...(rows.length
            ? [
                new Table({
                  visuallyRightToLeft: true,
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: rows.map(
                    (r, k) =>
                      new TableRow({
                        tableHeader: k === 0,
                        children: Array.from({ length: cols }, (_, j) =>
                          new TableCell({
                            shading: k === 0 ? { type: ShadingType.CLEAR, fill: hex(tint(c.accent, 0.14)), color: "auto" } : undefined,
                            margins: { top: 60, bottom: 60, left: 100, right: 100 },
                            children: [P(runs(r[j] ?? "", k === 0 ? { bold: true, boldComplexScript: true, font: font(head) } : {}))],
                          }),
                        ),
                      }),
                  ),
                }),
              ]
            : []),
          ...(b.text ? [P(runs(b.text), { alignment: AlignmentType.BOTH, spacing: { before: 120 } })] : []),
        ];
      }
      case "question":
        return [P([...runs("سؤال مراجعة: ", { color: hex(c.muted) }), ...runs(b.text, { bold: true, boldComplexScript: true, color: hex(c.accent) })])];
      case "scene":
        return [P([...runs(`${b.title}\n`, { bold: true, boldComplexScript: true, color: hex(c.accent), font: font(head) }), ...runs(b.text)], box(tint(c.accent, 0.09), c.line))];
      case "image": {
        const img = o.images?.[b.title];
        const size = img ? imageSize(img) : null;
        if (!img || !size) return [];
        const w = a4 ? 430 : 300;
        const h = Math.round((w * size.h) / Math.max(1, size.w));
        return [
          P([new ImageRun({ type: size.type, data: img, transformation: { width: w, height: Math.min(h, a4 ? 420 : 300) } })], { alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 } }),
          ...(b.text ? [P(runs(b.text, { color: hex(c.muted), size: half(pt * 0.8), sizeComplexScript: half(pt * 0.8) }), { alignment: AlignmentType.CENTER, spacing: { after: 200 } })] : []),
        ];
      }
      default:
        return [P(runs(b.text))];
    }
  }

  const children: (Paragraph | Table)[] = [];
  if (front.cover) {
    children.push(P([], { spacing: { before: a4 ? 4200 : 2800 } }), P(runs(doc.title), { heading: HeadingLevel.TITLE }));
    if (doc.subtitle) children.push(P(runs(doc.subtitle), { style: "Subtitle" }));
    children.push(P([new PageBreak()]));
  } else {
    children.push(P(runs(doc.title), { heading: HeadingLevel.TITLE }));
    if (doc.subtitle) children.push(P(runs(doc.subtitle), { style: "Subtitle" }));
  }
  if (front.toc) {
    children.push(P(runs("المحتويات"), { heading: HeadingLevel.HEADING_1 }));
    doc.chapters.forEach((ch, i) => children.push(P(runs(`${(i + 1).toLocaleString("ar")}. ${ch.title}`), { spacing: { after: 80 } })));
    children.push(P([new PageBreak()]));
  }
  doc.chapters.forEach((ch, i) => {
    children.push(P(runs(doc.chapters.length > 1 ? `الفصل ${(i + 1).toLocaleString("ar")}` : "", { color: hex(c.muted), size: half(pt * 0.85), sizeComplexScript: half(pt * 0.85) }), { pageBreakBefore: !fixed && i > 0, spacing: { before: fixed && i > 0 ? 360 : 0, after: 0 }, keepNext: true }));
    children.push(P(runs(ch.title), { heading: HeadingLevel.HEADING_1 }));
    for (const b of ch.blocks) children.push(...block(b));
  });
  if (o.sources?.length) {
    children.push(P(runs("مصادر البحث الخارجي"), { heading: HeadingLevel.HEADING_2 }));
    o.sources.forEach((s, i) =>
      children.push(
        P([new TextRun({ text: `${i + 1}. ${s.title} — `, rightToLeft: true, size: half(pt * 0.85), sizeComplexScript: half(pt * 0.85) }), new ExternalHyperlink({ link: s.url, children: [new TextRun({ text: s.url, style: "Hyperlink", size: half(pt * 0.8) })] }), new TextRun({ text: ` (اطّلع عليه: ${s.accessedAt.slice(0, 10)})`, rightToLeft: true, size: half(pt * 0.8), sizeComplexScript: half(pt * 0.8), color: hex(c.muted) })]),
      ),
    );
  }

  // the design's fonts inside the file, so it opens the same on a computer without them (the regular file of each)
  const embed: { name: string; data: Buffer }[] = [];
  for (const f of [head, body, accent]) {
    const file = f.files.find((x) => x.weight === "400") ?? f.files[0] ?? null;
    if (!file || embed.some((e) => e.name === f.family)) continue;
    try {
      embed.push({ name: f.family, data: await readFile(path.join(FONT_DIR, file.file)) });
    } catch {}
  }

  const run = (f: typeof head, size: number, color: string, bold = false): IRunOptions => ({ font: font(f), size: half(size), sizeComplexScript: half(size), color: hex(color), bold, boldComplexScript: bold, rightToLeft: true });
  const line = (n: number) => Math.round(n * 240);
  const frameBorder = { style: BorderStyle.SINGLE, size: 6, color: hex(tint(c.accent, 0.55)), space: 24 };
  const d = new Document({
    title: doc.title,
    creator: "الطالب الذكي — الجواد الذكي",
    fonts: embed,
    styles: {
      default: {
        document: { run: run(body, pt, c.ink), paragraph: { spacing: { after: 140, line: line(1.5) } } },
        title: { run: run(head, pt * 2.5, c.accent, true), paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 160, line: line(1.2) } } },
        heading1: { run: run(head, pt * 1.75, c.accent, true), paragraph: { spacing: { before: 120, after: 200, line: line(1.25) }, keepNext: true } },
        heading2: { run: run(head, pt * 1.3, c.ink, true), paragraph: { spacing: { before: 280, after: 120, line: line(1.25) }, keepNext: true } },
        heading3: { run: run(head, pt * 1.1, c.accent, true), paragraph: { spacing: { before: 200, after: 100 }, keepNext: true } },
      },
      paragraphStyles: [
        { id: "Subtitle", name: "Subtitle", basedOn: "Normal", next: "Normal", quickFormat: true, run: run(body, pt * 1.25, c.muted), paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 360 } } },
      ],
    },
    numbering: {
      config: [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.START, style: { paragraph: { indent: { start: 567, hanging: 283 } } } }] }],
    },
    sections: [
      {
        properties: {
          page: {
            size: a4 ? { width: 11906, height: 16838 } : { width: 8391, height: 11906 },
            margin: a4 ? { top: 1134, bottom: 1247, left: 1020, right: 1020, footer: 567 } : { top: 850, bottom: 964, left: 737, right: 737, footer: 454 },
            ...(design.frame !== false
              ? { borders: { pageBorders: { display: "allPages", offsetFrom: "page" }, pageBorderTop: frameBorder, pageBorderBottom: frameBorder, pageBorderLeft: frameBorder, pageBorderRight: frameBorder } }
              : {}),
          },
        },
        footers: { default: new Footer({ children: [P([new TextRun({ children: [PageNumber.CURRENT], size: 18, color: hex(c.muted) })], { alignment: AlignmentType.CENTER })] }) },
        children,
      },
    ],
  });
  const out = await Packer.toBuffer(d);
  if (out.length < 2000) throw new Error("empty DOCX");
  return Buffer.from(out);
}
