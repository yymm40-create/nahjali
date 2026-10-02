import { promises as fs } from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import sharp, { type OverlayOptions } from "sharp";
import type { Template, TemplateText } from "@/lib/templates";
import { templateFilePath } from "@/lib/templates";

const MM_TO_PT = 72 / 25.4;
const FONTS: Record<TemplateText["font"], { file: string; weight?: number }> = {
  display: { file: "assets/fonts/Lalezar-Regular.ttf" },
  body: { file: "assets/fonts/BalooBhaijaan2.ttf", weight: 800 },
  /** Titles and names (matches the page titles) */
  title: { file: "assets/fonts/Lemonada.ttf", weight: 700 },
  /** Speech bubbles and handwritten-style messages */
  hand: { file: "assets/fonts/PlaypenSansArabic.ttf", weight: 800 },
};

interface ComposeInput {
  style: string;
  childName: string;
  /** Optional message from the parents ({message} in the template) */
  parentMessage?: string;
  /** Transparent PNG per pose key */
  poses: Record<string, Buffer>;
}

const DPI = 300;
const PX_PER_MM = DPI / 25.4;

/**
 * Builds the booklet PDF. Each page is flattened into one 300 DPI JPEG (much smaller PDF than
 * transparent layers), drawn back to front:
 * 1. the background scene (one fixed set for every art style),
 * 2. the child standing on the floor at the bottom of each slot, with a soft shadow,
 * 3. the transparent overlay (titles, cards, trackers),
 * 4. "front" children (inside picture frames / sticker rings),
 * 5. per-order texts such as the child's name (rendered with real Arabic shaping).
 */
export async function composeBooklet(template: Template, input: ComposeInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${template.name} — ${input.childName}`);

  const pageW = template.page_size_mm.width * MM_TO_PT;
  const pageH = template.page_size_mm.height * MM_TO_PT;
  const pxW = Math.round(template.page_size_mm.width * PX_PER_MM);
  const pxH = Math.round(template.page_size_mm.height * PX_PER_MM);
  const px = (mm: number) => Math.round(mm * PX_PER_MM);

  // Each pose is trimmed once so its bounding box is the character itself (feet = bottom edge)
  const poses = new Map<string, { buf: Buffer; width: number; height: number }>();
  for (const [key, buf] of Object.entries(input.poses)) {
    const { data, info } = await sharp(buf).trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
    poses.set(key, { buf: data, width: info.width, height: info.height });
  }

  for (const tplPage of template.pages) {
    const layers: OverlayOptions[] = [];

    const addSlots = async (front: boolean) => {
      for (const slot of tplPage.slots.filter((s) => Boolean(s.front) === front)) {
        const pose = poses.get(slot.pose);
        if (!pose) throw new Error(`Missing pose image: ${slot.pose}`);
        const scale = Math.min(px(slot.width_mm) / pose.width, px(slot.height_mm) / pose.height);
        const w = Math.max(1, Math.round(pose.width * scale));
        const h = Math.max(1, Math.round(pose.height * scale));
        // Centered horizontally, standing on the bottom of the slot
        const left = px(slot.x_mm) + Math.round((px(slot.width_mm) - w) / 2);
        const top = px(slot.y_mm + slot.height_mm) - h;
        if (!front) {
          const sw = Math.round(w * 0.8), sh = Math.max(20, Math.round(w * 0.16));
          layers.push({
            input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}"><defs><radialGradient id="g"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="${sw / 2}" cy="${sh / 2}" rx="${sw / 2}" ry="${sh / 2}" fill="url(#g)"/></svg>`),
            left: Math.max(0, left + Math.round((w - sw) / 2)),
            top: Math.min(pxH - sh, top + h - Math.round(sh / 2)),
          });
        }
        layers.push({ input: await sharp(pose.buf).resize(w, h).png().toBuffer(), left: Math.max(0, left), top: Math.max(0, top) });
      }
    };

    await addSlots(false);
    layers.push({ input: await sharp(await fs.readFile(templateFilePath(template.id, tplPage.overlay))).resize(pxW, pxH).png().toBuffer(), left: 0, top: 0 });
    await addSlots(true);

    for (const t of tplPage.texts) {
      const value = t.value.replaceAll("{name}", input.childName).replaceAll("{message}", input.parentMessage ?? "").trim();
      if (!value) continue; // e.g. no parent message: the printed lines stay empty for handwriting
      const png = await renderText(t, value);
      const meta = await sharp(png).metadata();
      const scale = Math.min(px(t.width_mm) / meta.width!, px(t.height_mm) / meta.height!);
      const w = Math.max(1, Math.round(meta.width! * scale));
      const h = Math.max(1, Math.round(meta.height! * scale));
      layers.push({
        input: await sharp(png).resize(w, h).png().toBuffer(),
        left: px(t.x_mm) + Math.round((px(t.width_mm) - w) / 2),
        top: px(t.y_mm) + Math.round((px(t.height_mm) - h) / 2),
      });
    }

    const base = tplPage.scene
      ? sharp(await fs.readFile(templateFilePath(template.id, `scenes/${tplPage.scene}.jpg`))).resize(pxW, pxH)
      : sharp({ create: { width: pxW, height: pxH, channels: 3, background: "#fff8e8" } });
    const jpg = await base.composite(layers).jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:4:4" }).toBuffer();
    const page = pdf.addPage([pageW, pageH]);
    page.drawImage(await pdf.embedJpg(jpg), { x: 0, y: 0, width: pageW, height: pageH });
  }

  return pdf.save();
}

// ── Text rendering ───────────────────────────────────────────────────────────
// HarfBuzz shapes the Arabic text (joining, RTL, marks) directly from the bundled font file,
// and we draw the glyph outlines as SVG. This gives identical results locally and on Vercel,
// without depending on system fonts.

type HbFont = InstanceType<(typeof import("harfbuzzjs"))["Font"]>;
const fontCache = new Map<string, Promise<{ font: HbFont; upem: number }>>();

function loadFont(kind: TemplateText["font"]) {
  if (!fontCache.has(kind)) {
    fontCache.set(
      kind,
      (async () => {
        const hb = await import("harfbuzzjs");
        const data = await fs.readFile(path.join(process.cwd(), FONTS[kind].file));
        const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const face = new hb.Face(new hb.Blob(bytes));
        const font = new hb.Font(face);
        if (FONTS[kind].weight) font.setVariations([new hb.Variation("wght", FONTS[kind].weight)]);
        return { font, upem: face.upem };
      })(),
    );
  }
  return fontCache.get(kind)!;
}

/** Shapes one line; glyphs come back in visual (left-to-right) order, ready to lay out. */
async function shapeLine(font: HbFont, text: string) {
  const hb = await import("harfbuzzjs");
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  let x = 0;
  const paths: string[] = [];
  const positions = buffer.getGlyphPositions();
  for (const [i, glyph] of buffer.getGlyphInfos().entries()) {
    const p = positions[i];
    if (glyph.codepoint === 0) continue; // character not in the font (e.g. an emoji): skip it, no empty box
    paths.push(`<path transform="translate(${x + p.xOffset} ${p.yOffset})" d="${font.glyphToPath(glyph.codepoint)}"/>`);
    x += p.xAdvance;
  }
  return { paths: paths.join(""), width: x };
}

/**
 * Lettering effects, drawn back to front: depth (extrusion) + outer ring, a rim ring, then the gradient face.
 * Sizes are fractions of the font size (em), like the CSS titles in the booklet design.
 */
const EFFECTS = {
  /** Design A sticker lettering: white face, thick black outline, hard diagonal shadow */
  sticker: { stops: ["#ffffff", "#ffffff"], depth: "#111111", outer: "#111111", outerEm: 0.07, rim: null, rimEm: 0, depthEm: 0.1, diagonal: true },
  /** Epic 3D title (matches .t3): 3-tone gold face, white rim, navy outline and extrusion */
  epic: { stops: ["#fff7cf", "#ffe066", "#f5b50d", "#c97c00", "#ffd65c"], depth: "#0d1d4f", outer: "#0d1d4f", outerEm: 0.1, rim: "#ffffff", rimEm: 0.06, depthEm: 0.1, diagonal: false },
  /** Navy face, gold rim, white edge, bronze depth */
  "3d": { stops: ["#2c4a8c", "#18306a", "#0b1d45"], depth: "#6a3f00", outer: "#ffffff", outerEm: 0.15, rim: "#f6c64a", rimEm: 0.08, depthEm: 0.11, diagonal: false },
  /** Gold lettering for dark plates (name tags) */
  gold: { stops: ["#fff3b8", "#ffd34d", "#e0a10e", "#b87a06"], depth: null, outer: null, outerEm: 0, rim: null, rimEm: 0, depthEm: 0, diagonal: false },
} as const;

function layers(t: TemplateText, upem: number, ascender: number, descender: number) {
  const layer = (attrs: string) => `<use xlink:href="#t" ${attrs} stroke-linejoin="round"/>`;
  const fx = t.effect ? EFFECTS[t.effect] : null;
  if (!fx) {
    const outer = t.stroke ? 0.09 * upem : 0;
    return {
      pad: outer + 20,
      svg: (t.stroke ? layer(`fill="${t.stroke}" stroke="${t.stroke}" stroke-width="${outer * 2}"`) : "") + layer(`fill="${t.color}"`),
    };
  }
  const outer = fx.outerEm * upem;
  const depth = fx.depthEm * upem;
  const stops = fx.stops.map((c, i) => `<stop offset="${i / (fx.stops.length - 1)}" stop-color="${c}"/>`).join("");
  let svg = `<defs><linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" y1="${ascender * 0.8}" x2="0" y2="${descender * 0.3}">${stops}</linearGradient></defs>`;
  if (fx.depth) {
    for (let k = depth; k > 0; k -= depth / 5) svg += layer(`transform="translate(${fx.diagonal ? k : 0} ${-k})" fill="${fx.depth}" stroke="${fx.depth}" stroke-width="${outer * 2}"`);
  }
  if (fx.outer) svg += layer(`fill="${fx.outer}" stroke="${fx.outer}" stroke-width="${outer * 2}"`);
  if (fx.rim) svg += layer(`fill="${fx.rim}" stroke="${fx.rim}" stroke-width="${fx.rimEm * upem * 2}"`);
  svg += layer(`fill="url(#f)"`);
  return { pad: outer + depth + 20, svg };
}

const SVG_NS = `xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`;

/** Renders text to a transparent PNG: one line scaled to fit, or (wrap) several centered lines filling the box. */
async function renderText(t: TemplateText, value: string): Promise<Buffer> {
  const { font, upem } = await loadFont(t.font);
  const { ascender, descender } = font.hExtents();

  if (!t.wrap) {
    const line = await shapeLine(font, value);
    const fx = layers(t, upem, ascender, descender);
    const w = line.width + fx.pad * 2;
    const h = ascender - descender + fx.pad * 2;
    const pxPerUnit = 700 / h; // ~700px tall bitmap, plenty for print after scaling down
    const svg = `<svg ${SVG_NS} width="${Math.ceil(w * pxPerUnit)}" height="${Math.ceil(h * pxPerUnit)}" viewBox="${-fx.pad} ${-ascender - fx.pad} ${w} ${h}">
      <g transform="scale(1 -1)"><defs><g id="t">${line.paths}</g></defs>${fx.svg}</g></svg>`;
    // Trim to the ink so the text fills its box as large as possible
    return sharp(Buffer.from(svg)).trim({ threshold: 1 }).png().toBuffer();
  }

  // Wrapped text: try font sizes from large to small until the greedy word-wrap fits the box
  const words = value.split(" ");
  const lineHeight = (ascender - descender) * 1.08;
  let lines: { paths: string; width: number }[] = [];
  let boxW = 0;
  let boxH = 0;
  for (let emMm = t.height_mm / 1.1; ; emMm *= 0.92) {
    const unitsPerMm = upem / emMm;
    boxW = t.width_mm * unitsPerMm;
    boxH = t.height_mm * unitsPerMm;
    lines = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (current && (await shapeLine(font, candidate)).width > boxW) {
        lines.push(await shapeLine(font, current));
        current = word;
      } else current = candidate;
    }
    if (current) lines.push(await shapeLine(font, current));
    const fits = lines.length * lineHeight <= boxH && lines.every((l) => l.width <= boxW);
    if (fits || emMm < 2) break;
  }
  const top = (boxH - lines.length * lineHeight) / 2;
  const body = lines
    .map((l, i) => `<g transform="translate(${(boxW - l.width) / 2} ${top + i * lineHeight + ascender}) scale(1 -1)">${l.paths}</g>`)
    .join("");
  const pxPerUnit = 1600 / boxW;
  const svg = `<svg ${SVG_NS} width="${Math.ceil(boxW * pxPerUnit)}" height="${Math.ceil(boxH * pxPerUnit)}" viewBox="0 0 ${boxW} ${boxH}"><g fill="${t.color}">${body}</g></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
