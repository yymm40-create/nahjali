// Browser only. pdf.js (Mozilla, Apache-2.0), kept as files of our own site under /vendor/pdfjs-<version>/ (the legacy
// build, for older phones), loaded only when a book is opened: books are read page by page inside the platform.

const BASE = "/vendor/pdfjs-4.10.38";

export interface PdfViewport {
  width: number;
  height: number;
}
export interface PdfPage {
  getViewport(o: { scale: number }): PdfViewport;
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport; transform?: number[] }): { promise: Promise<void>; cancel(): void };
  cleanup(): void;
}
export interface PdfDoc {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}
interface PdfJs {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: Record<string, unknown>): { promise: Promise<PdfDoc>; destroy(): Promise<void> };
}

let lib: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  const url = `${BASE}/pdf.min.mjs`;
  lib ??= (import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url) as Promise<PdfJs>)
    .then((m) => {
      m.GlobalWorkerOptions.workerSrc = `${BASE}/pdf.worker.min.mjs`;
      return m;
    })
    .catch((e) => {
      lib = null;
      throw e;
    });
  return lib;
}

const COMMON = { cMapUrl: `${BASE}/cmaps/`, cMapPacked: true, standardFontDataUrl: `${BASE}/standard_fonts/`, isEvalSupported: false };

/** Opens a PDF from a link, reading only the parts it needs (range requests). */
export async function openPdf(url: string): Promise<PdfDoc> {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ ...COMMON, url, disableAutoFetch: true, rangeChunkSize: 262144 }).promise;
}

/** The number of pages of a PDF picked on this device (the owner attaching a guide book's file). */
export async function countPdfPages(file: File): Promise<number> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ ...COMMON, data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}
