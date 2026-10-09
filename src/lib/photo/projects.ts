// «زهراء فوتو ماستر» — the projects: kept per person with the canvas document, the conversation with «زهراء» and the
// record the robots pass between them. A project can start from nothing, from a picture the person uploads, from a work in
// «أعمالي», or from a design of «كاظم» — and a design that came from him can go back to him, edited. Server only.

import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { PHOTO } from "@config/photo";
import { getChat, lastDesignAt, saveChat, type Turn as DesignerTurn } from "@/lib/designer/chats";
import { fileBytes as designerFileBytes, uploadBytes, addFile as addDesignerFile } from "@/lib/designer/files";
import { nearestAspect } from "@/lib/designer/split";
import { type Design } from "@/lib/designer/layers";
import { docFromPicture, fitRect, newDoc, readDoc, type PhotoDoc, type PhotoLayer, type TextLayer } from "./doc";
import { addFile, projectPaths } from "./files";

const db = () => createAdminClient();
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

export interface Source {
  kind: "designer" | "upload" | "work" | "blank";
  chatId?: string;
  designId?: string;
  label?: string;
}

export interface PhotoTurn {
  role: "user" | "assistant";
  text: string;
  suggestions?: string[];
  /** a note from the site (a file arrived from جواد, the design went back to كاظم…), not a model answer */
  note?: boolean;
  error?: boolean;
}

export interface Project {
  id: string;
  title: string;
  doc: PhotoDoc;
  record: string;
  messages: PhotoTurn[];
  source: Source | null;
  usd: number;
  updatedAt: string;
}

export function readSource(v: unknown): Source | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const kind = o.kind === "designer" || o.kind === "upload" || o.kind === "work" || o.kind === "blank" ? o.kind : null;
  if (!kind) return null;
  return { kind, ...(typeof o.chatId === "string" ? { chatId: o.chatId } : {}), ...(typeof o.designId === "string" ? { designId: o.designId } : {}), ...(typeof o.label === "string" ? { label: o.label.slice(0, 120) } : {}) };
}

export function cleanMessages(raw: unknown): PhotoTurn[] {
  if (!Array.isArray(raw)) return [];
  const out: PhotoTurn[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const m = t as Record<string, unknown>;
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (!role || typeof m.text !== "string" || !m.text.trim()) continue;
    const turn: PhotoTurn = { role, text: m.text.slice(0, role === "user" ? PHOTO.messageMax : 30_000) };
    const s = Array.isArray(m.suggestions) ? m.suggestions.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim().slice(0, 100)).slice(0, 4) : [];
    if (role === "assistant" && s.length) turn.suggestions = s;
    if (m.note === true) turn.note = true;
    if (m.error === true) turn.error = true;
    out.push(turn);
  }
  return out.slice(-200);
}

const view = (r: Record<string, unknown>): Project => ({
  id: r.id as string,
  title: str(r.title, 120),
  doc: readDoc(r.doc),
  record: str(r.record, 20_000),
  messages: cleanMessages(r.messages),
  source: readSource(r.source),
  usd: Number(r.usd ?? 0),
  updatedAt: String(r.updated_at ?? ""),
});

export async function listProjects(userId: string) {
  const { data, error } = await db().from("photo_projects").select("id,title,source,updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(PHOTO.maxProjects);
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id as string, title: String(r.title || "مشروع جديد"), source: readSource(r.source), updatedAt: String(r.updated_at) }));
}

export async function getProject(userId: string, id: string): Promise<Project | null> {
  const { data } = await db().from("photo_projects").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data ? view(data) : null;
}

async function createRow(userId: string, o: { title: string; source: Source; record?: string; messages?: PhotoTurn[] }): Promise<string> {
  const { count } = await db().from("photo_projects").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= PHOTO.maxProjects) throw new UserError(`وصلت للحد (${PHOTO.maxProjects} مشروع)؛ احذف مشاريع قديمة أول.`, 409);
  const { data, error } = await db()
    .from("photo_projects")
    .insert({ user_id: userId, title: o.title.slice(0, 120), doc: newDoc(), record: (o.record ?? "").slice(0, 20_000), source: o.source, messages: o.messages ?? [] })
    .select("id")
    .single();
  if (error || !data) throw new UserError("ما قدرنا ننشئ المشروع. هل شغّلت ملف SQL رقم 0046؟", 500);
  return data.id as string;
}

/** Saves the document (checked) and, when given, the title and the conversation. */
export async function saveProject(userId: string, id: string, patch: { doc?: unknown; title?: string; messages?: PhotoTurn[]; record?: string; addUsd?: number }): Promise<PhotoDoc | null> {
  const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let doc: PhotoDoc | null = null;
  if (patch.doc !== undefined) {
    doc = readDoc(patch.doc);
    if (JSON.stringify(doc).length > 400_000) throw new UserError("المشروع كبير جدًا.", 413);
    set.doc = doc;
  }
  if (patch.title !== undefined) set.title = patch.title.trim().slice(0, 120);
  if (patch.messages) set.messages = patch.messages;
  if (patch.record !== undefined) set.record = patch.record.slice(0, 20_000);
  if (patch.addUsd) {
    const { data } = await db().from("photo_projects").select("usd").eq("id", id).eq("user_id", userId).maybeSingle();
    set.usd = Number(data?.usd ?? 0) + patch.addUsd;
  }
  const { data, error } = await db().from("photo_projects").update(set).eq("id", id).eq("user_id", userId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new UserError("ما لقينا هذا المشروع.", 404);
  return doc;
}

export async function deleteProject(userId: string, id: string) {
  const paths = await projectPaths(userId, id);
  await db().from("photo_projects").delete().eq("id", id).eq("user_id", userId);
  // pictures that came from جواد's desk stay in «أعمالي»: only the project's own copies are removed
  if (paths.length) await storage.from(JAWAD_BUCKET).remove(paths).catch(() => null);
}

const GREETING = (from: string) => `هلا! أنا زهراء. ${from} وش تبي أسوي؟ تقدر تقول مثلًا: «حسّن الألوان»، «قصّها لستوري»، «اكتب في آخرها اسمي بخط عريض»، أو «خلها بإحساس سينمائي».`;
const note = (text: string): PhotoTurn => ({ role: "assistant", text, note: true });

/** A project from nothing: a coloured canvas. */
export async function openBlank(userId: string, width: number, height: number, bg: string): Promise<string> {
  const id = await createRow(userId, { title: "لوحة جديدة", source: { kind: "blank" }, messages: [note(GREETING("لوحة فاضية جاهزة،"))] });
  await saveProject(userId, id, { doc: newDoc(width, height, bg) });
  return id;
}

/** A project around bytes (an uploaded picture, a work). */
async function openFromBytes(userId: string, bytes: Buffer, name: string, source: Source, greeting: string): Promise<string> {
  const id = await createRow(userId, { title: name.replace(/\.[a-z0-9]+$/i, "") || "صورة", source, messages: [note(greeting)] });
  try {
    const f = await addFile({ userId, projectId: id, bytes, name, role: "base" });
    await saveProject(userId, id, { doc: docFromPicture({ id: f.id, w: f.width, h: f.height }) });
    return id;
  } catch (e) {
    await deleteProject(userId, id);
    throw e;
  }
}

/** One of the person's JAWAD AI uploads (a picture they attached) as a project. */
export async function openFromUpload(userId: string, uploadId: string): Promise<string> {
  const up = await uploadBytes(userId, uploadId);
  if (!up) throw new UserError("ما لقينا هذي الصورة بين مرفقاتك.", 404);
  return openFromBytes(userId, up.bytes, up.name, { kind: "upload" }, GREETING("فتحت صورتك."));
}

/** A picture of «أعمالي» (a JAWAD AI output) as a project. */
export async function openFromWork(userId: string, outputId: string): Promise<string> {
  const { data } = await db().from("jawad_outputs").select("storage_path,mime,kind,prompt").eq("id", outputId).eq("user_id", userId).maybeSingle();
  if (!data || data.kind !== "image") throw new UserError("ما لقينا هذه الصورة في أعمالك.", 404);
  const dl = await storage.from(JAWAD_BUCKET).download(data.storage_path as string);
  if (dl.error || !dl.data) throw new UserError("ما قدرنا نقرأ الصورة.", 500);
  return openFromBytes(userId, Buffer.from(await dl.data.arrayBuffer()), "عمل من أعمالي", { kind: "work" }, GREETING("فتحت عملك من «أعمالي»."));
}

const RECORD_GAP = "\n\n";

/**
 * The last design in a conversation with «كاظم» (or the one at message `at`), opened here: his artwork is the base, his text
 * layers stay real text, his cut-outs become picture layers, and his project record goes with it so «زهراء» knows what was asked.
 */
export async function openFromDesigner(userId: string, chatId: string, at?: number): Promise<string> {
  const chat = await getChat(userId, chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة مع كاظم.", 404);
  const idx = at !== undefined && chat.messages[at]?.design ? at : lastDesignAt(chat.messages);
  const design = idx >= 0 ? chat.messages[idx].design : undefined;
  if (!design || design.state !== "ready" || !design.artwork) throw new UserError("ما فيه تصميم جاهز عند كاظم لنفتحه.", 409);
  const art = await designerFileBytes(userId, design.artwork);
  if (!art) throw new UserError("ما قدرنا نقرأ صورة التصميم.", 404);

  const record = [`[وصل من «كاظم» — ${chat.title}]`, chat.record.trim() || "(لا سجل محفوظ عند كاظم)"].join("\n");
  const id = await createRow(userId, {
    title: chat.title || "تصميم من كاظم",
    source: { kind: "designer", chatId, designId: design.id, label: chat.title },
    record,
    messages: [note(GREETING("وصلني تصميمك من كاظم ومعه سجل مشروعه، فأعرف وش طلبت."))],
  });
  try {
    const base = await addFile({ userId, projectId: id, bytes: art, name: "عمل كاظم الفني", role: "base", meta: { from: "designer", designId: design.id } });
    const size = { width: design.width, height: design.height };
    let doc = docFromPicture({ id: base.id, w: base.width, h: base.height });
    doc = { ...doc, width: size.width, height: size.height };
    if (doc.base) doc.base.crop = fitRect({ x: 0, y: 0, w: 1, h: 1 }, { w: base.width, h: base.height }, size.width / size.height);
    const layers: PhotoLayer[] = [];
    for (const l of design.layers) {
      if (l.kind === "text") layers.push({ ...l });
      else {
        const cut = await designerFileBytes(userId, l.fileId);
        if (!cut) continue;
        const f = await addFile({ userId, projectId: id, bytes: cut, name: "قصاصة من كاظم", role: "layer", meta: { from: "designer" } });
        layers.push({ ...l, fileId: f.id });
      }
    }
    // pictures lie under the words
    doc.layers = [...layers.filter((l) => l.kind !== "text"), ...layers.filter((l) => l.kind === "text")];
    await saveProject(userId, id, { doc });
    return id;
  } catch (e) {
    await deleteProject(userId, id);
    throw e;
  }
}

export interface Returned {
  chatId: string;
  url: string;
}

/**
 * The edited design goes back to «كاظم»: the artwork (everything but the words) as his new artwork, the words as his text
 * layers, the PNG as the saved final, and what «زهراء» changed written into his project record and as a line in the chat.
 */
export async function returnToDesigner(userId: string, projectId: string, files: { artwork: Buffer; final?: Buffer }, summary: string): Promise<Returned> {
  const project = await getProject(userId, projectId);
  if (!project) throw new UserError("ما لقينا هذا المشروع.", 404);
  const src = project.source;
  if (src?.kind !== "designer" || !src.chatId) throw new UserError("هذا المشروع ما جاء من كاظم.", 409);
  const chat = await getChat(userId, src.chatId);
  if (!chat) throw new UserError("اختفت المحادثة الأصلية مع كاظم.", 404);

  const meta = await sharp(files.artwork, { failOn: "none" }).metadata().catch(() => null);
  if (!meta?.width || !meta.height || meta.format !== "png") throw new UserError("صورة العمل الفني ليست PNG صالحة.", 400);
  const art = await addDesignerFile({ userId, chatId: src.chatId, bytes: files.artwork, name: `artwork-zahraa-${randomUUID().slice(0, 6)}`, role: "artwork", width: meta.width, height: meta.height, meta: { from: "photo", projectId } });
  let finalId: string | undefined;
  if (files.final) {
    const fm = await sharp(files.final, { failOn: "none" }).metadata().catch(() => null);
    if (fm?.width && fm.height && fm.format === "png") finalId = (await addDesignerFile({ userId, chatId: src.chatId, bytes: files.final, name: `design-zahraa-${randomUUID().slice(0, 6)}`, role: "final", width: fm.width, height: fm.height })).id;
  }
  const doc = project.doc;
  const design: Design = {
    id: randomUUID().slice(0, 8),
    aspect: nearestAspect(doc.width, doc.height),
    width: meta.width,
    height: meta.height,
    artwork: art.id,
    layers: doc.layers.filter((l): l is TextLayer => l.kind === "text"),
    state: "ready",
    ...(finalId ? { final: finalId } : {}),
  };
  const line = summary.trim() || "عدّلت زهراء الصورة.";
  const turn: DesignerTurn = { role: "assistant", text: `🪄 رجع التصميم من «زهراء فوتو ماستر» بعد التعديل.\n\n${line}`, design };
  const record = `${chat.record.trim()}${chat.record.trim() ? RECORD_GAP : ""}[من زهراء فوتو ماستر — ${new Date().toLocaleDateString("ar-SA")}]\n${project.record.split("\n").filter((l) => !l.startsWith("[وصل من")).join("\n").trim() || line}`;
  await saveChat(userId, src.chatId, { messages: [...chat.messages, turn], record: record.slice(-20_000) });
  await saveProject(userId, projectId, { messages: [...project.messages, note("↩️ رجّعت التصميم لكاظم بعد التعديل.")] });
  return { chatId: src.chatId, url: `/jawad-ai/designer?chat=${src.chatId}` };
}
