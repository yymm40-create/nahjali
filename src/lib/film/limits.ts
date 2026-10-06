// «التحكم بالموارد والمحاولات»: the film maker's limits, set by the owner from /admin/limits.
// Each limit resolves per user: their email's value → their plan's (later) → everyone's → the default here.
// Until the film_limits table exists (migration 0014), the defaults below apply.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, isUnlimited } from "@config/site";

export const LIMITS = {
  edits_screenwriter: { label: "تعديلات السيناريست", hint: "طلبات «تعديل» و«توجيه» في محادثة السيناريست، لكل مشروع", default: 2, perUser: true },
  edits_sheets: { label: "تعديلات صانع الشيت", hint: "لكل مشروع", default: 2, perUser: true },
  edits_director: { label: "تعديلات المخرج والفيديو", hint: "تشمل «اطلب تعديل» بعد الفيديو، لكل مشروع", default: 2, perUser: true },
  videos: { label: "فيديوهات التجربة المجانية", hint: "لكل مستخدم في فترة التجربة؛ بعد آخر فيديو تنتهي تجربته", default: 1, perUser: true },
  trial_users: { label: "عدد المستخدمين في التجربة", hint: "للموقع كله؛ بعدها يقفل صانع الفيلم على الكل إلا أنت", default: 6, perUser: false },
  // «الممنتج الذكي»
  editor_claude_daily: { label: "طلبات Claude في الممنتج الذكي", hint: "لكل شخص في اليوم", default: 40, perUser: true },
  editor_speech_minutes: { label: "دقائق الكابشن ومزامنة القصائد", hint: "دقائق صوت تُفرَّغ لكل شخص في اليوم", default: 120, perUser: true },
  editor_price_claude: { label: "سعر طلب Claude في الممنتج (نقدة)", hint: "يُخصم بس إذا شغّلت «النقود الذكية مطلوبة»؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_caption: { label: "سعر دقيقة الكابشن في الممنتج (نقدة)", hint: "لكل دقيقة صوت (تُقرّب للأعلى)، بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_hook: { label: "سعر هوك بالصورة في الممنتج (نقدة)", hint: "صورة GPT Image 2 مفرّغة؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_music: { label: "سعر دقيقة موسيقى في الممنتج (نقدة)", hint: "ElevenLabs Music؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_stems: { label: "سعر دقيقة فصل الأصوات في الممنتج (نقدة)", hint: "كلام وموسيقى ومؤثرات؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
} as const;
export type LimitKey = keyof typeof LIMITS;

export interface LimitRow {
  scope: "all" | "email" | "plan";
  target: string;
  key: LimitKey | `access_${string}` | `allow_${string}`;
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
  if (isUnlimited(email)) return null;
  const limit = await getLimit(`edits_${stage}`, email);
  return Math.max(0, limit - (await editsUsed(projectId, stage)));
}

/** Throws a clear message when the user has no edits left in this stage. */
export async function assertCanEdit(projectId: string, stage: "screenwriter" | "sheets" | "director", email?: string | null) {
  const left = await editsLeft(projectId, stage, email);
  if (left === 0) throw new UserError("خلصت التعديلات المتاحة لك في هذي المرحلة. تقدر تعتمد وتكمّل.", 403);
}

// ───────────── Who can use each section (also set from /admin/limits) ─────────────
// Stored in the same table: key "access_<section>" (scope all) = the mode's code; per email,
// key "allow_<section>" = 1 (always allowed) or 0 (blocked), whatever the mode.

export const ACCESS_MODES = {
  closed: { code: 0, label: "مغلق (أنت بس)" },
  invite: { code: 1, label: "إيميلات محددة بس" },
  trial: { code: 2, label: "تجربة لأول عدد من المستخدمين" },
  open: { code: 3, label: "مفتوح للجميع" },
} as const;
export type AccessMode = keyof typeof ACCESS_MODES;

export const SECTIONS_ACCESS = {
  film: { label: "🎬 صانع الفيلم", modes: ["closed", "invite", "trial", "open"] as AccessMode[], default: "trial" as AccessMode },
  booklet: { label: "📖 كتيب نهج علي", modes: ["closed", "invite", "open"] as AccessMode[], default: "closed" as AccessMode },
  // «الجواد الذكي!» | JAWAD AI: closed by default — the owner only; everyone else sees «قيد التطوير». "invite" = the emails below
  jawad: { label: "✨ JAWAD AI", modes: ["closed", "invite", "open"] as AccessMode[], default: "closed" as AccessMode },
} as const;
export type AccessSection = keyof typeof SECTIONS_ACCESS;

const modeOf = (code: number | undefined): AccessMode | undefined =>
  (Object.entries(ACCESS_MODES).find(([, m]) => m.code === code)?.[0] as AccessMode | undefined);

/** The section's current mode for everyone. */
export async function accessMode(section: AccessSection, rows?: LimitRow[]): Promise<AccessMode> {
  const r = (rows ?? (await limitRows())).find((x) => x.scope === "all" && (x.key as string) === `access_${section}`);
  const m = modeOf(r?.value);
  return m && SECTIONS_ACCESS[section].modes.includes(m) ? m : SECTIONS_ACCESS[section].default;
}

/** A per-email decision for the section: true (always allowed), false (blocked) or undefined (follow the mode). */
export async function emailAccess(section: AccessSection, email?: string | null, rows?: LimitRow[]) {
  const mail = email?.toLowerCase();
  if (!mail) return undefined;
  const r = (rows ?? (await limitRows())).find((x) => x.scope === "email" && x.target === mail && (x.key as string) === `allow_${section}`);
  return r === undefined ? undefined : r.value > 0;
}

/** «كتيب نهج علي»: may this user open it? The owner always can. */
export async function bookletOpenFor(email?: string | null) {
  if (isAdmin(email)) return true;
  const rows = await limitRows();
  const own = await emailAccess("booklet", email, rows);
  if (own !== undefined) return own;
  const mode = await accessMode("booklet", rows);
  return mode === "open";
}
