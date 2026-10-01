import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, type PDFImage } from "pdf-lib";
import sharp from "sharp";
import type { Template, TemplateText } from "@/lib/templates";
import { templateFilePath } from "@/lib/templates";

const MM_TO_PT = 72 / 25.4;
const FONTS: Record<TemplateText["font"], { file: string; weight?: number }> = {
  display: { file: "assets/fonts/Lalezar-Regular.ttf" },
  body: { file: "assets/fonts/BalooBhaijaan2.ttf", weight: 800 },
};

interface ComposeInput {
  style: string;
  childName: string;
  /** Transparent PNG per pose key */
  poses: Record<string, Buffer>;
}

/**
 * Builds the booklet PDF. For each page, in order:
 * 1. the background scene (one fixed set for every art style),
 * 2. the child (trimmed to its outline) standing on the floor at the bottom of each slot, with a soft shadow,
 * 3. the transparent overlay (titles, cards, trackers),
 * 4. per-order texts such as the child's name (rendered with real Arabic shaping).
 */
export async function composeBooklet(template: Template, input: ComposeInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${template.name} — ${input.childName}`);

  const pageW = template.page_size_mm.width * MM_TO_PT;
  const pageH = template.page_size_mm.height * MM_TO_PT;

  // Each pose is trimmed once so its bounding box is the character itself (feet = bottom edge)
  const poses = new Map<string, PDFImage>();
  for (const [key, buf] of Object.entries(input.poses)) {
    poses.set(key, await pdf.embedPng(await sharp(buf).trim({ threshold: 1 }).png().toBuffer()));
  }
  const scenes = new Map<string, PDFImage>();

  for (const tplPage of template.pages) {
    const page = pdf.addPage([pageW, pageH]);

    if (tplPage.scene) {
      if (!scenes.has(tplPage.scene)) {
        const file = templateFilePath(template.id, `scenes/${tplPage.scene}.jpg`);
        scenes.set(tplPage.scene, await pdf.embedJpg(await fs.readFile(file)));
      }
      page.drawImage(scenes.get(tplPage.scene)!, { x: 0, y: 0, width: pageW, height: pageH });
    }

    for (const slot of tplPage.slots) {
      const img = poses.get(slot.pose);
      if (!img) throw new Error(`Missing pose image: ${slot.pose}`);
      const boxW = slot.width_mm * MM_TO_PT;
      const boxH = slot.height_mm * MM_TO_PT;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      // Centered horizontally, standing on the bottom of the slot
      const x = slot.x_mm * MM_TO_PT + (boxW - w) / 2;
      const bottom = pageH - (slot.y_mm + slot.height_mm) * MM_TO_PT;
      page.drawEllipse({ x: x + w / 2, y: bottom + 1.5, xScale: w * 0.38, yScale: Math.max(4, w * 0.07), opacity: 0.28 });
      page.drawImage(img, { x, y: bottom, width: w, height: h });
    }

    const overlay = await pdf.embedPng(await fs.readFile(templateFilePath(template.id, tplPage.overlay)));
    page.drawImage(overlay, { x: 0, y: 0, width: pageW, height: pageH });

    for (const t of tplPage.texts) {
      const png = await renderText(t, t.value.replaceAll("{name}", input.childName));
      const img = await pdf.embedPng(png);
      const boxW = t.width_mm * MM_TO_PT;
      const boxH = t.height_mm * MM_TO_PT;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      page.drawImage(img, {
        x: t.x_mm * MM_TO_PT + (boxW - w) / 2,
        y: pageH - t.y_mm * MM_TO_PT - (boxH + h) / 2,
        width: w,
        height: h,
      });
    }
  }

  return pdf.save();
}

// ── Text rendering ───────────────────────────────────────────────────────────
// HarfBuzz shapes the Arabic text (joining, RTL, marks) directly from the bundled font file,
// and we draw the glyph outlines as SVG. This gives identical results locally and on Vercel,
// without depending on system fonts.

type HbFont = InstanceType<(typeof import("harfbuzzjs"))["Font"]>;
const fontCache = new Map<string, Promise<HbFont>>();

function loadFont(kind: TemplateText["font"]): Promise<HbFont> {
  if (!fontCache.has(kind)) {
    fontCache.set(
      kind,
      (async () => {
        const hb = await import("harfbuzzjs");
        const data = await fs.readFile(path.join(process.cwd(), FONTS[kind].file));
        const bytes = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const font = new hb.Font(new hb.Face(new hb.Blob(bytes)));
        if (FONTS[kind].weight) font.setVariations([new hb.Variation("wght", FONTS[kind].weight)]);
        return font;
      })(),
    );
  }
  return fontCache.get(kind)!;
}

const EFFECTS = {
  /** Logo-style 3D lettering: turquoise face, gold rim, navy depth (matches the page titles) */
  "3d": { stops: ["#a8f4f7", "#2cc3cf", "#0f8c9e", "#0a6878"], rim: "#f6c64a", depth: "#0b2a55" },
  /** Gold lettering for dark plates (name tags) */
  gold: { stops: ["#fff3b8", "#ffd34d", "#e0a10e", "#b87a06"], rim: null, depth: null },
} as const;

/** Renders one line of text to a transparent PNG, flat (color/stroke) or with a 3D effect. */
async function renderText(t: TemplateText, value: string): Promise<Buffer> {
  const hb = await import("harfbuzzjs");
  const font = await loadFont(t.font);
  const buffer = new hb.Buffer();
  buffer.addText(value);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);

  // Glyphs come back in visual (left-to-right) order, ready to lay out
  let x = 0;
  const paths: string[] = [];
  const positions = buffer.getGlyphPositions();
  for (const [i, glyph] of buffer.getGlyphInfos().entries()) {
    const p = positions[i];
    paths.push(`<path transform="translate(${x + p.xOffset} ${p.yOffset})" d="${font.glyphToPath(glyph.codepoint)}"/>`);
    x += p.xAdvance;
  }

  const { ascender, descender } = font.hExtents();
  const fx = t.effect ? EFFECTS[t.effect] : null;
  // Outline widths in font units (half of each stroke falls outside the glyph)
  const outer = fx?.depth ? 150 : t.stroke ? 90 : 0;
  const rim = fx?.rim ? 80 : 0;
  const depth = fx?.depth ? 110 : 0;
  const pad = outer + depth + 20;
  const w = x + pad * 2;
  const h = ascender - descender + pad * 2;
  const pxPerUnit = 700 / h; // ~700px tall bitmap, plenty for print after scaling down

  const layer = (attrs: string) => `<use xlink:href="#t" ${attrs} stroke-linejoin="round"/>`;
  let layers: string;
  if (fx) {
    const stops = fx.stops.map((c, i) => `<stop offset="${i / (fx.stops.length - 1)}" stop-color="${c}"/>`).join("");
    layers = `<defs><linearGradient id="f" gradientUnits="userSpaceOnUse" x1="0" y1="${ascender * 0.8}" x2="0" y2="${descender * 0.3}">${stops}</linearGradient></defs>`;
    if (fx.depth) {
      for (let k = depth; k > 0; k -= 22) layers += layer(`transform="translate(0 ${-k})" fill="${fx.depth}" stroke="${fx.depth}" stroke-width="${outer * 2}"`);
      layers += layer(`fill="#ffffff" stroke="#ffffff" stroke-width="${outer * 2}"`);
    }
    if (fx.rim) layers += layer(`fill="${fx.rim}" stroke="${fx.rim}" stroke-width="${rim * 2}"`);
    layers += layer(`fill="url(#f)"`);
  } else {
    layers =
      (t.stroke ? layer(`fill="${t.stroke}" stroke="${t.stroke}" stroke-width="${outer * 2}"`) : "") + layer(`fill="${t.color}"`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Math.ceil(w * pxPerUnit)}" height="${Math.ceil(h * pxPerUnit)}" viewBox="${-pad} ${-ascender - pad} ${w} ${h}">
    <g transform="scale(1 -1)"><defs><g id="t">${paths.join("")}</g></defs>${layers}</g>
  </svg>`;
  // Trim to the ink so the text fills its box as large as possible
  return sharp(Buffer.from(svg)).trim({ threshold: 1 }).png().toBuffer();
}
