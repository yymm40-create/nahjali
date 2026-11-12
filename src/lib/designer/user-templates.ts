// «قوالب المصممين» — designs a designer uploads with their frames and word boxes marked; the owner approves them, then
// everyone sees them in «دعوة مجلس» and changes only the names, photos and details (the rest of the design is locked).
// Kept in designer_kv under utpl:<id> (the picture is the designer's upload). Server only.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { readUserTemplate, type MajlisTemplate } from "@config/designer-majlis";

export interface UserTemplateRow {
  template: MajlisTemplate;
  /** the designer's jawad_uploads id: the design with empty frames */
  upload: string;
  by: string;
  byEmail: string;
  status: "pending" | "approved";
  at: string;
}

const db = () => createAdminClient();
const KEY = (id: string) => `utpl:${id}`;

function readRow(raw: unknown): UserTemplateRow | null {
  try {
    const o = (typeof raw === "string" ? JSON.parse(raw) : raw) as Record<string, unknown>;
    const template = readUserTemplate(o.template);
    if (!template || typeof o.upload !== "string" || typeof o.by !== "string") return null;
    return { template, upload: o.upload, by: o.by, byEmail: String(o.byEmail ?? ""), status: o.status === "approved" ? "approved" : "pending", at: String(o.at ?? "") };
  } catch {
    return null;
  }
}

export async function listTemplates(): Promise<UserTemplateRow[]> {
  const { data } = await db().from("designer_kv").select("value").like("key", "utpl:%").limit(500);
  return (data ?? []).map((r) => readRow(r.value)).filter((r): r is UserTemplateRow => !!r).sort((a, b) => b.at.localeCompare(a.at));
}

export async function getTemplate(id: string): Promise<UserTemplateRow | null> {
  const { data } = await db().from("designer_kv").select("value").eq("key", KEY(id)).maybeSingle();
  return data ? readRow(data.value) : null;
}

async function put(row: UserTemplateRow) {
  const { error } = await db().from("designer_kv").upsert({ key: KEY(row.template.id), value: JSON.stringify(row), updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** A designer's new template (waiting for the owner's approval). */
export async function addTemplate(user: { id: string; email?: string | null }, raw: unknown, upload: unknown): Promise<UserTemplateRow> {
  if (typeof upload !== "string" || !/^[0-9a-f-]{36}$/i.test(upload)) throw new UserError("ارفع صورة القالب أول.", 400);
  const id = `u${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const template = readUserTemplate({ ...(raw as object), id });
  if (!template) throw new UserError("حدّد مربع صورة واحد على الأقل ومكان الاسم الأول.", 400);
  const row: UserTemplateRow = { template, upload, by: user.id, byEmail: user.email ?? "", status: "pending", at: new Date().toISOString() };
  await put(row);
  return row;
}

export async function setStatus(id: string, status: "approved" | "removed") {
  if (status === "removed") {
    await db().from("designer_kv").delete().eq("key", KEY(id));
    return;
  }
  const row = await getTemplate(id);
  if (!row) throw new UserError("ما لقينا القالب.", 404);
  await put({ ...row, status });
}
