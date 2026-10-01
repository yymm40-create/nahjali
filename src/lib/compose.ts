import { promises as fs } from "fs";
import { PDFDocument } from "pdf-lib";
import type { Template } from "@/lib/templates";
import { templateFilePath } from "@/lib/templates";

const MM_TO_PT = 72 / 25.4;

/**
 * Builds the booklet PDF: each template page image is the full-page background,
 * then the matching pose image is placed in every slot (scaled to fit, centered).
 * Page artwork is 300 DPI, so the PDF prints sharp at the template's physical size.
 */
export async function composeBooklet(template: Template, poseImages: Record<string, Buffer>): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(template.name);

  const pageW = template.page_size_mm.width * MM_TO_PT;
  const pageH = template.page_size_mm.height * MM_TO_PT;

  // Embed each pose once, reuse across pages
  const embedded = new Map<string, Awaited<ReturnType<PDFDocument["embedPng"]>>>();
  for (const [key, buf] of Object.entries(poseImages)) embedded.set(key, await pdf.embedPng(buf));

  for (const tplPage of template.pages) {
    const page = pdf.addPage([pageW, pageH]);
    const bg = await pdf.embedPng(await fs.readFile(templateFilePath(template.id, tplPage.file)));
    page.drawImage(bg, { x: 0, y: 0, width: pageW, height: pageH });

    for (const slot of tplPage.slots) {
      const img = embedded.get(slot.pose);
      if (!img) throw new Error(`Missing pose image: ${slot.pose}`);

      const boxW = slot.width_mm * MM_TO_PT;
      const boxH = slot.height_mm * MM_TO_PT;
      const scale = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      // Template coordinates are from the top-left; PDF coordinates are from the bottom-left.
      const x = slot.x_mm * MM_TO_PT + (boxW - w) / 2;
      const yTop = slot.y_mm * MM_TO_PT + (boxH - h) / 2;
      page.drawImage(img, { x, y: pageH - yTop - h, width: w, height: h });
    }
  }

  return pdf.save();
}
