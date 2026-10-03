// «التحكم بالموارد والمحاولات»: the film maker's limits, set by the owner from /admin/limits.
// Each limit resolves per user: their email's value → their plan's (later) → everyone's → the default here.
// Until the film_limits table exists (migration 0014), the defaults below apply.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";

export const LIMITS = {
  edits_screenwriter: { label: "تعديلات السيناريست", hint: "طلبات «تعديل» و«توجيه» في محادثة السيناريست، لكل مشروع", default: 2, perUser: true },
  edits_sheets: { label: "تعديلات صانع الشيت", hint: "لكل مشروع", default: 2, perUser: true },
  edits_director: { label: "تعديلات المخرج والفيديو", hint: "تشمل «اطلب تعديل» بعد الفيديو، لكل مشروع", default: 2, perUser: true },
  videos: { label: "فيديوهات التجربة المجانية", hint: "لكل مستخدم في فترة التجربة؛ بعد آخر فيديو تنتهي تجربته", default: 1, perUser: true },
  trial_users: { label: "عدد المستخدمين في التجربة", hint: "للموقع كله؛ بعدها يقفل صانع الفيلم على الكل إلا أنت", default: 6, perUser: false },
} as const;
export type LimitKey = keyof typeof LIMITS;

export interface LimitRow {
  scope: "all" | "email" | "plan";
  target: string;
  key: LimitKey;
  value: number;
}

/** Every stored limit (empty if the table doesn't exist yet). */
export async function limitRows(): Promise<LimitRow[]> {
  const { data, error } = await createAdminClient().from("film_limits").select("scope,target,key,value");
  if (error) return [];
  return (data ?? []) as LimitRow[];
}

/** One limit for one user (or for everyone when no email is given). */
export async function getLimit(key: LimitKey, email?: string | null) {
  const rows = (await limitRows()).filter((r) => r.key === key);
  const mail = email?.toLowerCase();
  const own = mail ? rows.find((r) => r.scope === "email" && r.target === mail) : undefined;
  const all = rows.find((r) => r.scope === "all");
  return (own ?? all)?.value ?? LIMITS[key].default;
}

// Every edit-type message starts with one of these (see the revise actions), so they can be counted
const EDIT_PREFIXES = ["تعديل", "توجيه / أمر جديد:", "ملاحظاتي على فيديو"];

async function editsUsed(projectId: string, stage: "screenwriter" | "sheets" | "director") {
  const { data } = await createAdminClient().from("film_messages").select("content").eq("project_id", projectId).eq("stage", stage).eq("role", "user");
  return (data ?? []).filter((m) => EDIT_PREFIXES.some((p) => String(m.content).startsWith(p))).length;
}

/** Edits left for this user in this stage of this project (null: no limit, the owner). */
export async function editsLeft(projectId: string, stage: "screenwriter" | "sheets" | "director", email?: string | null) {
  if (isAdmin(email)) return null;
  const limit = await getLimit(`edits_${stage}`, email);
  return Math.max(0, limit - (await editsUsed(projectId, stage)));
}

/** Throws a clear message when the user has no edits left in this stage. */
export async function assertCanEdit(projectId: string, stage: "screenwriter" | "sheets" | "director", email?: string | null) {
  const left = await editsLeft(projectId, stage, email);
  if (left === 0) throw new UserError("خلصت التعديلات المتاحة لك في هذي المرحلة. تقدر تعتمد وتكمّل.", 403);
}
