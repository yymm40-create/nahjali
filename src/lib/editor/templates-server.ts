// «قوالب المونتاج» in «حيدرة كت»: the person's own templates («احفظ كقالب»), kept in editor_templates (migration 0115).
// Server only. Until 0115 runs, the list is empty with `ready: false` and saving says the file is needed; the ready
// templates live in the code (templates.ts) and work either way.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { readTemplate, type Template } from "./templates";

const db = () => createAdminClient();
/** the most templates one person keeps */
export const MAX_TEMPLATES = 50;
export const TEMPLATES_NOT_READY = "حفظ القوالب يحتاج تحديث قاعدة البيانات أول (ملف 0115).";
const ID = /^[0-9a-f-]{36}$/i;

/** The person's templates, newest first; `ready: false` before 0115 has run. */
export async function listTemplates(userId: string): Promise<{ ready: boolean; templates: Template[] }> {
  const { data, error } = await db().from("editor_templates").select("id,doc").eq("user_id", userId).order("created_at", { ascending: false }).limit(MAX_TEMPLATES);
  if (error) return { ready: false, templates: [] };
  return { ready: true, templates: (data ?? []).flatMap((r) => readTemplate(r.doc, `u:${r.id}`) ?? []) };
}

/** Keeps a template the page made from the project (checked again here); its id back. */
export async function saveTemplate(userId: string, raw: unknown): Promise<Template> {
  const t = readTemplate(raw);
  if (!t) throw new UserError("القالب فاضي: يحتاج مقطع واحد على الأقل في المسار الرئيسي.");
  const { count, error: e } = await db().from("editor_templates").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if (e) throw new UserError(TEMPLATES_NOT_READY, 503);
  if ((count ?? 0) >= MAX_TEMPLATES) throw new UserError(`عندك ${MAX_TEMPLATES} قالب؛ احذف واحد قديم أول.`, 429);
  const { id: _id, ...doc } = t;
  void _id;
  const { data, error } = await db().from("editor_templates").insert({ user_id: userId, name: t.name, ratio: t.ratio, doc }).select("id").single();
  if (error) throw new UserError(TEMPLATES_NOT_READY, 503);
  return { ...t, id: `u:${data.id}` };
}

export async function deleteTemplate(userId: string, id: unknown) {
  const raw = typeof id === "string" ? id.replace(/^u:/, "") : "";
  if (!ID.test(raw)) throw new UserError("ما لقينا هذا القالب.", 404);
  const { error } = await db().from("editor_templates").delete().eq("id", raw).eq("user_id", userId);
  if (error) throw new UserError(TEMPLATES_NOT_READY, 503);
}
