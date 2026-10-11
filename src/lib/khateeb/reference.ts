// «الخطيب الذكي» — مرجع الأشعار: a scanned PDF the owner uploads, read page by page (Claude reads each page and writes it out, with
// the number printed on it), kept in the database and searched when the Sheikh needs lines for a sermon. The whole reference
// is there; the sermon takes from it only what it asks for, with the page number. Server only.

import { PDFDocument } from "pdf-lib";
import { UserError } from "@/lib/api";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { askJson } from "@/lib/jawad/student/claude";
import { STUDENT } from "@config/jawad/student";
import { fetchBook } from "./alhassanain";
import { norm } from "./tafsir";

const db = () => createAdminClient();
const BUCKET = STUDENT.bucket;
export const REF_NOT_READY = "«مرجع الأشعار» ما تجهّز بعد: شغّل ملف SQL رقم 0067 في Supabase.";
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(e.message ?? ""));

/** Pages read in one call (a small PDF of the next pages goes to Claude). */
export const REF_PAGES_PER_CALL = 3;

/** What a reference is: poetry (lines to quote) or a source (stories, wisdom, lessons: facts to draw on). */
export type RefKind = "poetry" | "source";
export const readRefKind = (v: unknown): RefKind => (v === "source" ? "source" : "poetry");

export interface Ref {
  id: string;
  title: string;
  kind: RefKind;
  /** where it came from when it was not uploaded (a library's page) */
  origin: string;
  pages: number;
  done: number;
  status: "uploading" | "reading" | "ready" | "failed";
  error: string;
  usd: number;
  createdAt: string;
}

const view = (r: Record<string, unknown>): Ref => ({
  id: String(r.id),
  title: String(r.title ?? ""),
  kind: readRefKind(r.kind),
  origin: String(r.origin ?? ""),
  pages: Number(r.pages ?? 0),
  done: Number(r.done ?? 0),
  status: (r.status as Ref["status"]) ?? "uploading",
  error: String(r.error ?? ""),
  usd: Number(r.usd ?? 0),
  createdAt: String(r.created_at ?? ""),
});

export async function listRefs(): Promise<{ refs: Ref[]; ready: boolean }> {
  const { data, error } = await db().from("khateeb_refs").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) return { refs: [], ready: !missing(error) };
  return { refs: (data ?? []).map(view), ready: true };
}

async function row(id: string): Promise<Record<string, unknown>> {
  const { data, error } = await db().from("khateeb_refs").select("*").eq("id", id).maybeSingle();
  if (error && missing(error)) throw new UserError(REF_NOT_READY, 503);
  if (!data) throw new UserError("ما لقينا هذا المرجع.", 404);
  return data;
}

/** A new reference: its row, and where the browser uploads the PDF to. */
export async function startRef(title: string, bytes: number, kind: RefKind = "poetry"): Promise<{ id: string; signedUrl: string }> {
  if (!(bytes > 0) || bytes > 500 * 1024 * 1024) throw new UserError("حجم الملف لازم يكون أقل من ٥٠٠ ميجا.");
  const { data, error } = await db().from("khateeb_refs").insert({ title: title.trim().slice(0, 200) || (kind === "source" ? "مصدر" : "مرجع الأشعار"), kind }).select("id").single();
  if (error || !data) {
    if (missing(error) || error?.code === "42703") throw new UserError(REF_NOT_READY, 503);
    throw error ?? new Error("no ref");
  }
  const path = `khateeb/ref/${data.id}.pdf`;
  await db().from("khateeb_refs").update({ path }).eq("id", data.id);
  const up = await storage.from(BUCKET).createSignedUploadUrl(path);
  if (up.error) throw up.error;
  return { id: data.id as string, signedUrl: up.data.signedUrl };
}

/** The upload finished: the file is checked and its pages counted; reading starts. */
export async function confirmRef(id: string): Promise<Ref> {
  const r = await row(id);
  let buf: Buffer;
  try {
    buf = Buffer.from(await (await storage.from(BUCKET).download(String(r.path))).data!.arrayBuffer());
  } catch {
    throw new UserError("ما وصل الملف. جرّب رفعه مرة ثانية.");
  }
  if (buf.subarray(0, 1024).toString("latin1").indexOf("%PDF-") < 0) throw new UserError("هذا الملف ليس PDF صالحًا.");
  const pages = (await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  await db().from("khateeb_refs").update({ pages, done: 0, status: "reading", error: "" }).eq("id", id);
  return view(await row(id));
}

const TRANSCRIBE = `You transcribe pages of a book of Arabic poetry and verse (scanned), to text, exactly.
- Copy every word as printed, in reading order (right-to-left). Never summarise, correct, translate, complete or reorder anything.
- Keep the diacritics (tashkeel) exactly where they are printed. Never add any.
- Each verse (بيت) on its own line; its two hemistichs separated by « … » when the page shows them apart. A poem's title or its poet's name, when printed, on its own line starting with "# ".
- Prose (introductions, notes, footnotes) is copied as it is, one paragraph per line block.
- A word you cannot read: write ⟦؟⟧ in its place; a word you can only partly read: your best reading with a question mark inside the marks, ⟦كلمة؟⟧. Never fill a gap by guessing silently.
- "label": the page number printed on the page (digits as printed), or an empty string when there is none. A running header or footer is not copied unless it carries content.`;

const PAGE = {
  type: "object",
  properties: { text: { type: "string" }, label: { type: "string" } },
  required: ["text", "label"],
  additionalProperties: false,
};

async function slice(buf: Buffer, from: number, count: number) {
  const src = await PDFDocument.load(buf, { ignoreEncryption: true, updateMetadata: false });
  const out = await PDFDocument.create();
  for (const p of await out.copyPages(src, Array.from({ length: count }, (_, i) => from + i))) out.addPage(p);
  return Buffer.from(await out.save()).toString("base64");
}

/** One batch of pages read and kept; the reference is `ready` when the last is. Safe to call again and from two places. */
export async function stepRef(id: string): Promise<Ref> {
  const r = await row(id);
  if (r.status !== "reading") return view(r);
  const pages = Number(r.pages);
  const from = Number(r.done);
  if (from >= pages) {
    await db().from("khateeb_refs").update({ status: "ready" }).eq("id", id);
    return view(await row(id));
  }
  const count = Math.min(REF_PAGES_PER_CALL, pages - from);
  try {
    const buf = Buffer.from(await (await storage.from(BUCKET).download(String(r.path))).data!.arrayBuffer());
    const read = await askJson<{ pages: { text: string; label: string }[] }>({
      system: TRANSCRIBE,
      parts: [
        { type: "pdf", base64: await slice(buf, from, count) },
        { type: "text", text: `This PDF has exactly ${count} page(s). Return "pages" with exactly ${count} item(s), one per page, in order.` },
      ],
      schema: { type: "object", properties: { pages: { type: "array", items: PAGE } }, required: ["pages"], additionalProperties: false },
      maxTokens: 6000 * count,
    });
    if (read.data.pages.length !== count) throw new Error(`expected ${count} pages, got ${read.data.pages.length}`);
    // the batch is kept only by the call that moves `done` on (a second call for the same pages does nothing)
    const { data: moved } = await db().from("khateeb_refs").update({ done: from + count, usd: Number(r.usd) + read.usd, error: "" }).eq("id", id).eq("done", from).select("id");
    if (moved?.length) {
      const rows = read.data.pages.map((p, k) => ({ ref_id: id, page: from + k + 1, label: p.label.trim().slice(0, 20), text: p.text, norm: norm(p.text) }));
      const { error } = await db().from("khateeb_ref_pages").upsert(rows, { onConflict: "ref_id,page" });
      if (error) throw error;
    }
    if (from + count >= pages) await db().from("khateeb_refs").update({ status: "ready" }).eq("id", id);
  } catch (e) {
    console.error("khateeb ref step", id, e);
    await db().from("khateeb_refs").update({ error: `توقف عند الصفحة ${from + 1}: ${e instanceof Error ? e.message.slice(0, 200) : "خطأ"}. اضغط «كمّل» مرة ثانية.` }).eq("id", id);
  }
  return view(await row(id));
}

/** A book of شبكة الإمامين الحسنين brought in as it is (its text and page numbers), ready at once: nothing is read from pictures, nothing is charged. */
export async function importBook(id: number, kind: RefKind, title: string): Promise<Ref> {
  const book = await fetchBook(id);
  const { data, error } = await db()
    .from("khateeb_refs")
    .insert({ title: (title.trim() || book.title || `كتاب ${id}`).slice(0, 200), kind, origin: book.url, pages: book.pages.length, done: book.pages.length, status: "ready" })
    .select("id")
    .single();
  if (error || !data) {
    if (missing(error) || error?.code === "42703") throw new UserError(REF_NOT_READY, 503);
    throw error ?? new Error("no ref");
  }
  for (let i = 0; i < book.pages.length; i += 100) {
    const rows = book.pages.slice(i, i + 100).map((p, k) => ({ ref_id: data.id, page: i + k + 1, label: p.label.slice(0, 20), text: p.text.slice(0, 40_000), norm: norm(p.text.slice(0, 40_000)) }));
    const { error: e2 } = await db().from("khateeb_ref_pages").upsert(rows, { onConflict: "ref_id,page" });
    if (e2) {
      await db().from("khateeb_refs").delete().eq("id", data.id);
      throw e2;
    }
  }
  return view(await row(data.id as string));
}

export async function deleteRef(id: string) {
  const r = await row(id);
  await db().from("khateeb_refs").delete().eq("id", id);
  if (r.path) await storage.from(BUCKET).remove([String(r.path)]).catch(() => null);
}

export interface RefPage {
  refId: string;
  title: string;
  page: number;
  /** the number printed on the page, or the page's place in the file when none could be read */
  label: string;
  text: string;
}

export async function getPage(id: string, page: number): Promise<RefPage | null> {
  const r = await row(id);
  const { data } = await db().from("khateeb_ref_pages").select("*").eq("ref_id", id).eq("page", page).maybeSingle();
  return data ? { refId: id, title: String(r.title), page, label: String(data.label || page), text: String(data.text) } : null;
}

/** A page's text corrected by the owner (the search text follows). */
export async function savePage(id: string, page: number, text: string) {
  const body = text.slice(0, 40_000);
  const { error } = await db().from("khateeb_ref_pages").update({ text: body, norm: norm(body) }).eq("ref_id", id).eq("page", page);
  if (error) throw error;
}

/** The references that are ready (what a preacher may choose from), of one kind or all. */
export async function readyRefs(kind?: RefKind): Promise<{ id: string; title: string; kind: RefKind; pages: number }[]> {
  const { data, error } = await db().from("khateeb_refs").select("id,title,kind,pages").eq("status", "ready").order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => ({ id: String(r.id), title: String(r.title), kind: readRefKind(r.kind), pages: Number(r.pages) })).filter((r) => !kind || r.kind === kind);
}

/**
 * The pages that hold these words, best first: the ones with the most of the words, from every reference that is read. The
 * search is over the text without marks and alef spellings, so «الصبر» finds «ٱلصَّبْرِ».
 */
export async function searchRef(keywords: string[], limit = 12, only?: { kind?: RefKind; ids?: string[] }): Promise<RefPage[]> {
  const words = [...new Set(keywords.map((k) => norm(k)).filter((k) => k.length >= 3))].slice(0, 16);
  if (!words.length) return [];
  const { data: refs } = await db().from("khateeb_refs").select("id,title,kind").eq("status", "ready");
  const titles = new Map(
    (refs ?? [])
      .filter((r) => (!only?.kind || readRefKind(r.kind) === only.kind) && (!only?.ids?.length || only.ids.includes(String(r.id))))
      .map((r) => [String(r.id), String(r.title)] as const),
  );
  if (!titles.size) return [];
  const { data, error } = await db()
    .from("khateeb_ref_pages")
    .select("ref_id,page,label,text,norm")
    .in("ref_id", [...titles.keys()])
    .or(words.map((w) => `norm.ilike.%${w.replace(/[%,()]/g, " ")}%`).join(","))
    .limit(400);
  if (error) throw error;
  return (data ?? [])
    .map((p) => {
      const n = String(p.norm);
      const hits = words.filter((w) => n.includes(w));
      return { p, score: hits.length * 1000 + hits.reduce((s, w) => s + n.split(w).length - 1, 0) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ p }) => ({ refId: String(p.ref_id), title: titles.get(String(p.ref_id)) ?? "", page: Number(p.page), label: String(p.label || p.page), text: String(p.text) }));
}
