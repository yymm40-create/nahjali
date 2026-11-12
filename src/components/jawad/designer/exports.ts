"use client";

// «المصمم الذكي» — a finished design in other shapes and for print, made here in the page from the design itself:
// · one-click sizes (an Instagram post, a story, a WhatsApp status, a square): the design whole in the middle, the room
//   around it filled with the same design blurred and darkened (nothing is cut, nothing is stretched);
// · print: a PDF at A4 or A3 with a 3 mm bleed on every side (the design covers the bleed), ready for a print shop.

import { PDFDocument } from "pdf-lib";

export const SIZES = [
  { id: "post", label: "بوست انستغرام", w: 1080, h: 1350 },
  { id: "story", label: "ستوري", w: 1080, h: 1920 },
  { id: "status", label: "حالة واتساب", w: 1080, h: 1920 },
  { id: "square", label: "مربع", w: 1080, h: 1080 },
] as const;

export const PRINTS = [
  { id: "a4", label: "A4 للطباعة", mm: [210, 297] as const },
  { id: "a3", label: "A3 للطباعة", mm: [297, 420] as const },
] as const;

const BLEED_MM = 3;
const PT_PER_MM = 72 / 25.4;

async function picture(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** The design in another frame: whole in the middle, the room around it its own picture blurred and darkened. */
export async function refit(design: Blob, w: number, h: number): Promise<Blob> {
  const im = await picture(design);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d")!;
  // the room: the design covering the frame, blurred by shrinking it hard and drawing it back big (no canvas filter: Safari)
  const small = document.createElement("canvas");
  small.width = 24;
  small.height = Math.max(1, Math.round((24 * h) / w));
  const sx = small.getContext("2d")!;
  const cover = Math.max(small.width / im.width, small.height / im.height);
  sx.drawImage(im, (small.width - im.width * cover) / 2, (small.height - im.height * cover) / 2, im.width * cover, im.height * cover);
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = "high";
  x.drawImage(small, 0, 0, w, h);
  x.fillStyle = "rgba(0,0,0,0.45)";
  x.fillRect(0, 0, w, h);
  // the design itself, whole, as big as it fits
  const k = Math.min(w / im.width, h / im.height);
  const dw = im.width * k, dh = im.height * k;
  x.shadowColor = "rgba(0,0,0,0.55)";
  x.shadowBlur = Math.round(w * 0.03);
  x.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
  im.close();
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("ما قدرنا نجهّز المقاس."))), "image/png"));
}

export async function downloadSize(design: Blob, id: (typeof SIZES)[number]["id"]) {
  const s = SIZES.find((x) => x.id === id)!;
  save(await refit(design, s.w, s.h), `تصميم-${s.label}.png`);
}

/** A print PDF: the page is the paper plus a 3 mm bleed each side; the design covers it (its middle kept). */
export async function downloadPrint(design: Blob, id: (typeof PRINTS)[number]["id"]) {
  const p = PRINTS.find((x) => x.id === id)!;
  const [wmm, hmm] = p.mm;
  const W = (wmm + 2 * BLEED_MM) * PT_PER_MM, H = (hmm + 2 * BLEED_MM) * PT_PER_MM;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`تصميم — ${p.label}`);
  const bytes = new Uint8Array(await design.arrayBuffer());
  const img = design.type === "image/jpeg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
  const page = pdf.addPage([W, H]);
  const k = Math.max(W / img.width, H / img.height);
  page.drawImage(img, { x: (W - img.width * k) / 2, y: (H - img.height * k) / 2, width: img.width * k, height: img.height * k });
  // where the print shop trims (the paper's edge): set as the page's trim box
  page.setTrimBox(BLEED_MM * PT_PER_MM, BLEED_MM * PT_PER_MM, wmm * PT_PER_MM, hmm * PT_PER_MM);
  page.setBleedBox(0, 0, W, H);
  const out = await pdf.save();
  save(new Blob([out as BlobPart], { type: "application/pdf" }), `تصميم-${p.label}.pdf`);
}

/** How many dots per inch the design gives at that paper (to say it plainly when it is low). */
export function printDpi(px: [number, number], id: (typeof PRINTS)[number]["id"]): number {
  const [wmm, hmm] = PRINTS.find((x) => x.id === id)!.mm;
  return Math.round(Math.min(px[0] / ((wmm + 2 * BLEED_MM) / 25.4), px[1] / ((hmm + 2 * BLEED_MM) / 25.4)));
}
