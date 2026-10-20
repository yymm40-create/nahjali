// «🎬 مختبر الموشن»: its conversations, kept on the server (migration 0087). A project has as many as the person opens;
// each one is the lab's whole work in it (the cards, the scenario, the versions, the plan, the program and the choices),
// so it opens again on any device. Before the table exists the lab keeps working on the device and says so once.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { stillOpen, type EditorProject } from "./server";

/** The most one conversation may weigh (a program alone may be 140k characters; a few versions are kept). */
export const LAB_CHAT_MAX = 1_500_000;
export const LAB_CHATS_LIST = 60;

const db = () => createAdminClient();
const missing = (e: { code?: string; message?: string } | null | undefined) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /motion_lab_chats/.test(e.message ?? ""));
const uuid = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : "");
const titleOf = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

export interface LabChatRow {
  id: string;
  title: string;
  updated_at: string;
}

/** The project's conversations, newest first (`missing` when the table is not there yet). */
export async function listLabChats(p: EditorProject, userId: string) {
  const { data, error } = await db().from("motion_lab_chats").select("id,title,updated_at").eq("user_id", userId).eq("project_id", p.id).order("updated_at", { ascending: false }).limit(LAB_CHATS_LIST);
  if (missing(error)) return { chats: [] as LabChatRow[], missing: true };
  if (error) throw new UserError("ما قدرت أجيب محادثات المختبر.", 500);
  return { chats: (data ?? []) as LabChatRow[], missing: false };
}

/** One conversation with its whole state. */
export async function getLabChat(p: EditorProject, userId: string, id: unknown) {
  const { data, error } = await db().from("motion_lab_chats").select("id,title,state,updated_at").eq("id", uuid(id)).eq("user_id", userId).eq("project_id", p.id).maybeSingle();
  if (missing(error)) return { chat: null, missing: true };
  if (error) throw new UserError("ما قدرت أفتح المحادثة.", 500);
  if (!data) throw new UserError("ما لقيت هالمحادثة (يمكن انحذفت).", 404);
  return { chat: data as LabChatRow & { state: Record<string, unknown> }, missing: false };
}

/** Saves a conversation (`id` empty → a new one); returns its id. */
export async function saveLabChat(p: EditorProject, userId: string, b: { id?: unknown; title?: unknown; state?: unknown }) {
  stillOpen(p);
  const state = b.state && typeof b.state === "object" && !Array.isArray(b.state) ? (b.state as Record<string, unknown>) : null;
  if (!state) throw new UserError("ما وصل محتوى المحادثة.", 400);
  if (JSON.stringify(state).length > LAB_CHAT_MAX) throw new UserError("المحادثة كبرت أكثر من اللي ينحفظ؛ افتح محادثة جديدة.", 413);
  const row = { title: titleOf(b.title), state, updated_at: new Date().toISOString() };
  const id = uuid(b.id);
  if (id) {
    const { data, error } = await db().from("motion_lab_chats").update(row).eq("id", id).eq("user_id", userId).eq("project_id", p.id).select("id").maybeSingle();
    if (missing(error)) return { id: "", missing: true };
    if (error) throw new UserError("ما قدرت أحفظ المحادثة.", 500);
    if (data) return { id, missing: false };
  }
  const { data, error } = await db().from("motion_lab_chats").insert({ ...row, user_id: userId, project_id: p.id }).select("id").single();
  if (missing(error)) return { id: "", missing: true };
  if (error || !data) throw new UserError("ما قدرت أحفظ المحادثة.", 500);
  return { id: (data as { id: string }).id, missing: false };
}

/** Renames a conversation. */
export async function renameLabChat(p: EditorProject, userId: string, b: { id?: unknown; title?: unknown }) {
  const title = titleOf(b.title);
  if (!title) throw new UserError("اكتب اسم المحادثة.", 400);
  const { error } = await db().from("motion_lab_chats").update({ title }).eq("id", uuid(b.id)).eq("user_id", userId).eq("project_id", p.id);
  if (error && !missing(error)) throw new UserError("ما قدرت أغيّر الاسم.", 500);
  return { ok: true };
}

/** Deletes a conversation for good. */
export async function deleteLabChat(p: EditorProject, userId: string, b: { id?: unknown }) {
  const { error } = await db().from("motion_lab_chats").delete().eq("id", uuid(b.id)).eq("user_id", userId).eq("project_id", p.id);
  if (error && !missing(error)) throw new UserError("ما قدرت أحذف المحادثة.", 500);
  return { ok: true };
}
