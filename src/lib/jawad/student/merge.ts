// «الطالب الذكي» · «ادمج النواتج في PDF واحد» — the finished outputs' PDFs put one after another in a single file, in
// the order the outputs are listed. Each output gives its drawn pages (pictures_pdf) when it has them, else its PDF.
// Free (nothing is generated), and made again each time so it always holds the outputs as they are now. Server only.

import { PDFDocument } from "pdf-lib";
import { UserError } from "@/lib/api";
import { getFile, outputs, putFile, signFile, type Project } from "./db";
import { MERGE_MAX_BYTES, MERGE_MAX_FILES, mergeParts } from "./merge-parts";

export interface Merged {
  url: string;
  /** the outputs that went in, in order */
  titles: string[];
  /** left out: no PDF, or not finished */
  skipped: string[];
  /** left out because their file could not be read */
  failed: string[];
  pages: number;
}

/** Puts the PDFs together and answers a 10-minute download link. */
export async function mergeOutputs(userId: string, p: Pick<Project, "id" | "title">, ids?: string[]): Promise<Merged> {
  const { parts, skipped } = mergeParts(await outputs(p.id), ids);
  if (!parts.length) throw new UserError("ما فيه ناتج جاهز له PDF يندمج. أكمل صنع نواتجك أول (الملخص، الكتاب، الشرائح، الاختبار…).");
  if (parts.length > MERGE_MAX_FILES) throw new UserError(`أكثر من ${MERGE_MAX_FILES} ناتج دفعة وحدة؛ اختر الأهم منها.`);
  const out = await PDFDocument.create();
  const titles: string[] = [];
  const failed: string[] = [];
  let bytes = 0;
  for (const part of parts) {
    try {
      const buf = await getFile(part.path);
      bytes += buf.byteLength;
      if (bytes > MERGE_MAX_BYTES) throw new UserError("ملفاتك كبيرة على دمج واحد؛ اختر عدداً أقل من النواتج.");
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      for (const page of await out.copyPages(src, src.getPageIndices())) out.addPage(page);
      titles.push(part.title);
    } catch (e) {
      if (e instanceof UserError) throw e;
      failed.push(part.title);
    }
  }
  if (!titles.length) throw new UserError("ما قدرت أقرأ ملفات النواتج. جرّب مرة ثانية بعد شوي.");
  const path = `${userId}/${p.id}/merged/all.pdf`;
  await putFile(path, await out.save(), "application/pdf");
  const name = `${(p.title || "المادة").replace(/[\\/:*?"<>|]/g, "").slice(0, 80)}-كل-النواتج.pdf`;
  return { url: await signFile(path, 600, name), titles, skipped, failed, pages: out.getPageCount() };
}
