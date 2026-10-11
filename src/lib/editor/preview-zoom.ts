// «تكبير المعاينة» — the picture in the preview at a chosen size of the screen: «ملء» (as large as fits), or a share of
// that (half, three quarters), or larger than the screen (120 %, 150 %, 200 %, 400 %) to look at an edge, a key or a
// text up close, scrolling around it. Like Premiere's «Fit / 25 … 400 %» and Resolve's viewer zoom. Pure.

export const PREVIEW_ZOOMS = [
  { id: "fit", ar: "ملء", factor: 1 },
  { id: "25", ar: "٢٥٪", factor: 0.25 },
  { id: "50", ar: "٥٠٪", factor: 0.5 },
  { id: "75", ar: "٧٥٪", factor: 0.75 },
  { id: "120", ar: "١٢٠٪", factor: 1.2 },
  { id: "150", ar: "١٥٠٪", factor: 1.5 },
  { id: "200", ar: "٢٠٠٪", factor: 2 },
  { id: "400", ar: "٤٠٠٪", factor: 4 },
] as const;
export type PreviewZoom = (typeof PREVIEW_ZOOMS)[number]["id"];
export const PREVIEW_ZOOM_KEY = "jw-editor-pz";

export const readPreviewZoom = (v: unknown): PreviewZoom => (PREVIEW_ZOOMS.some((z) => z.id === v) ? (v as PreviewZoom) : "fit");

/** The next (or previous) step from a zoom, in the list's order of size. */
export function stepZoom(z: PreviewZoom, dir: 1 | -1): PreviewZoom {
  const sorted = [...PREVIEW_ZOOMS].sort((a, b) => a.factor - b.factor);
  const i = sorted.findIndex((x) => x.id === z);
  return sorted[Math.min(sorted.length - 1, Math.max(0, i + dir))].id;
}

/**
 * The picture's size on screen: the largest size that fits the stage (keeping the frame's shape), times the zoom's
 * factor. «ملء» is that size itself. Sizes are whole pixels; a stage without size gives the frame's own size.
 */
export function previewSize(stageW: number, stageH: number, frameW: number, frameH: number, z: PreviewZoom): { w: number; h: number; fits: boolean } {
  const f = PREVIEW_ZOOMS.find((x) => x.id === z)?.factor ?? 1;
  if (!(stageW > 0 && stageH > 0 && frameW > 0 && frameH > 0)) return { w: frameW, h: frameH, fits: true };
  const fit = Math.min(stageW / frameW, stageH / frameH);
  const w = Math.max(1, Math.round(frameW * fit * f));
  const h = Math.max(1, Math.round(frameH * fit * f));
  return { w, h, fits: w <= stageW + 0.5 && h <= stageH + 0.5 };
}
