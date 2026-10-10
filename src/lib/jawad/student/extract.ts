// «الطالب الذكي» — getting the text out of the student's material, a few pages at a time. Server only.
// Typed text is kept exactly as written. Pictures and PDF pages are read by Claude (a PDF's own text layer is often
// broken for Arabic: reversed or in presentation forms), transcribed verbatim, with unreadable words marked, never
// guessed silently.

import { PDFDocument } from "pdf-lib";
import { STUDENT, readSourceRole, sourceRole } from "@config/jawad/student";
import { askJson, claudeCeilingUsd } from "./claude";
import { getFile, sdb, signFile, sources, touch, type Source } from "./db";
import type { Handler, Job } from "./jobs";

const TRANSCRIBE = `You transcribe study material to text, exactly.
- Copy every word as written, in reading order (right-to-left for Arabic). Do not summarise, correct, translate, reorder or complete anything.
- Keep the structure: put "# " before a main heading and "## " before a sub-heading, "- " before list items, one paragraph per line block separated by a blank line, table rows as cells joined by " | ".
- Keep diacritics (tashkeel) exactly where they are printed. Do not add any.
- A word you cannot read: write ⟦؟⟧ in its place. A word you can only partly read: write your best reading followed by a question mark inside the marks, e.g. ⟦الكلمة؟⟧. Never fill a gap silently.
- In "uncertain", list each marked place with a few words of the surrounding text so the student can find it.
- A page with no text (a picture only): return an empty text and say what is on it in "uncertain" (one item starting with "صفحة بلا نص:").
- Headers, footers and page numbers printed on the page: keep them only if they carry content (a chapter title), not a bare page number.`;

const PAGE = {
  type: "object",
  properties: { text: { type: "string" }, uncertain: { type: "array", items: { type: "string" } } },
  required: ["text", "uncertain"],
  additionalProperties: false,
};

/** Splits typed text into review parts at paragraph ends (nothing is changed or dropped). */
export function splitTyped(body: string, size = 3500): string[] {
  const paras = body.replace(/\r\n?/g, "\n").split(/\n{2,}/);
  const parts: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (cur && cur.length + p.length + 2 > size) {
      parts.push(cur);
      cur = p;
    } else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur || !parts.length) parts.push(cur);
  return parts;
}

export async function pdfPageCount(buf: Buffer) {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  return doc.getPageCount();
}

async function pdfSlice(buf: Buffer, from: number, count: number) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  const out = await PDFDocument.create();
  const idx = Array.from({ length: count }, (_, i) => from + i);
  for (const p of await out.copyPages(src, idx)) out.addPage(p);
  return Buffer.from(await out.save()).toString("base64");
}

const sourceLabel = (s: Source, i: number) => {
  const what = s.kind === "text" ? "النص المكتوب" : s.kind === "image" ? `صورة ${i + 1}` : `ملف PDF ${i + 1}`;
  const role = sourceRole(readSourceRole(s.role));
  // the role is part of the label, so it travels with the text into every step and every prompt
  return role && role.id !== "material" ? `${role.ar}: ${what}` : what;
};

async function insertSegments(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  // (source, page, part) is unique: a step that runs again after a crash adds nothing twice
  const { error } = await sdb().from("student_segments").upsert(rows, { onConflict: "source_id,page,part", ignoreDuplicates: true });
  if (error) throw error;
}

/** Pages (or pictures) still to read across the project, and the USD ceiling of reading them. */
export function extractCeiling(list: Source[]) {
  let pages = 0;
  let usd = 0;
  for (const s of list) {
    if (s.status !== "ready" || s.kind === "text") continue;
    const left = s.kind === "image" ? (s.pages_done ? 0 : 1) : Math.max(0, s.pages - s.pages_done);
    pages += left;
    usd += left * claudeCeilingUsd(0, 3500, 3200);
  }
  return { pages, usd };
}

async function step(job: Job) {
  const list = (await sources(job.project_id)).filter((s) => s.status === "ready");
  const todo = list.find((s) => (s.kind === "pdf" ? s.pages_done < s.pages : s.pages_done < 1));
  if (!todo) return { done: true, stage: "اكتمل الاستخراج" };
  const i = list.indexOf(todo);
  const label = sourceLabel(todo, i);
  const base = { project_id: job.project_id, user_id: job.user_id, source_id: todo.id };

  if (todo.kind === "text") {
    const parts = splitTyped(todo.body ?? "");
    await insertSegments(parts.map((t, k) => ({ ...base, page: 1, part: k + 1, label: parts.length > 1 ? `${label} · جزء ${k + 1}` : label, raw_text: t, text: t })));
    await sdb().from("student_sources").update({ pages_done: 1 }).eq("id", todo.id);
    return { done: false, stage: `حفظ ${label}` };
  }

  if (todo.kind === "image") {
    const url = await signFile(todo.path!, 900);
    const r = await askJson<{ text: string; uncertain: string[] }>({
      system: TRANSCRIBE,
      parts: [{ type: "image", url }, { type: "text", text: "Transcribe this picture." }],
      schema: PAGE,
      maxTokens: 12000,
    });
    await insertSegments([{ ...base, page: 1, part: 1, label: `${label}${todo.name ? ` (${todo.name})` : ""}`, raw_text: r.data.text, text: r.data.text, uncertain: r.data.uncertain }]);
    await sdb().from("student_sources").update({ pages_done: 1 }).eq("id", todo.id);
    return { done: false, usd: r.usd, stage: `قراءة ${label}` };
  }

  // PDF: the next few pages as their own small PDF
  const buf = await getFile(todo.path!);
  const count = Math.min(STUDENT.pdfPagesPerCall, todo.pages - todo.pages_done);
  const from = todo.pages_done;
  const r = await askJson<{ pages: { text: string; uncertain: string[] }[] }>({
    system: TRANSCRIBE,
    parts: [
      { type: "pdf", base64: await pdfSlice(buf, from, count) },
      { type: "text", text: `This PDF has exactly ${count} page(s). Return "pages" with exactly ${count} item(s), one per page, in order.` },
    ],
    schema: { type: "object", properties: { pages: { type: "array", items: PAGE } }, required: ["pages"], additionalProperties: false },
    maxTokens: 6000 * count,
  });
  if (r.data.pages.length !== count) throw new Error(`expected ${count} pages, got ${r.data.pages.length}`);
  await insertSegments(
    r.data.pages.map((p, k) => ({ ...base, page: from + k + 1, part: 1, label: `${label}${todo.name ? ` (${todo.name})` : ""} · صفحة ${from + k + 1}`, raw_text: p.text, text: p.text, uncertain: p.uncertain })),
  );
  await sdb().from("student_sources").update({ pages_done: from + count }).eq("id", todo.id);
  return { done: false, usd: r.usd, stage: `قراءة ${label}: الصفحات ${from + 1}–${from + count} من ${todo.pages}`, progress: { source: i + 1, sources: list.length, page: from + count, pages: todo.pages } };
}

export const extractHandler: Handler = {
  label: "استخراج النص",
  step,
  onSuccess: async (job) => touch(job.project_id, { stage: "review" }),
};

/**
 * The completeness check before the full text can be approved: every page / picture / typed part has its segment,
 * none twice, and every segment is approved.
 */
export async function coverage(projectId: string) {
  const [list, { data }] = await Promise.all([sources(projectId), sdb().from("student_segments").select("source_id,page,part,status").eq("project_id", projectId)]);
  const segs = (data ?? []) as { source_id: string; page: number; part: number; status: string }[];
  const missing: string[] = [];
  const duplicate: string[] = [];
  list.forEach((s, i) => {
    if (s.status !== "ready") return;
    const mine = segs.filter((g) => g.source_id === s.id);
    const expected = s.kind === "pdf" ? s.pages : 1;
    for (let p = 1; p <= expected; p++) {
      const n = mine.filter((g) => g.page === p && g.part === 1).length;
      if (n === 0) missing.push(`${sourceLabel(s, i)}${s.kind === "pdf" ? ` · صفحة ${p}` : ""}`);
      if (n > 1) duplicate.push(`${sourceLabel(s, i)} · صفحة ${p}`);
    }
  });
  const approved = segs.filter((g) => g.status === "approved").length;
  return { missing, duplicate, total: segs.length, approved, complete: !missing.length && !duplicate.length && approved === segs.length && segs.length > 0 };
}
