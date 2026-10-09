// The riyal pricing settings and «حيدرة كت»'s costs (halalas), set by the owner from /admin/limits (used only once «النقود الذكية مطلوبة» is on).
// Who may use what, free and without limits, is the dashboard's one list instead (src/lib/access.ts).
// Until the film_limits table exists (migration 0014), the defaults below apply.

import { createAdminClient } from "@/lib/supabase/admin";

export const LIMITS = {
  price_usd_sar_x100: { label: "💱 سعر الدولار بالهللة (375 = 3.75 ريال)", hint: "التكلفة تُحوَّل من الدولار إلى الريال بهذا السعر", default: 375, perUser: false },
  price_step_halalas: { label: "🔼 التقريب للأعلى (هللة)", hint: "كل سعر يُقرَّب للأعلى إلى هذا: 50 = نص ريال (0.45 → 0.50، 1.10 → 1.50)، 10 = عشر هللات، 100 = ريال كامل", default: 50, perUser: false },
  price_margin_pct: { label: "💰 نسبة الربح الحالية (٪)", hint: "تُضاف على التكلفة بعد تقريبها (وتُقرَّب هي أيضًا). 30 = عرض الإطلاق", default: 30, perUser: false },
  price_was_margin_pct: { label: "🏷️ نسبة الربح الكاملة (٪) — السعر المشطوب", hint: "السعر «كان» الذي يظهر مشطوبًا جنب السعر الحالي: نفس الحسبة بهذه النسبة", default: 60, perUser: false },
  editor_price_claude: { label: "تكلفة طلب Claude في حيدرة كت (هللة)", hint: "تكلفة بالهللة، يُضاف عليها الربح عند الخصم؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_voice: { label: "سعر رد حيدرة بالصوت في حيدرة كت (هللة)", hint: "تكلفة بالهللة لكل رد ينقرأ بصوت حيدرة (ElevenLabs)؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_caption: { label: "سعر دقيقة الكابشن في حيدرة كت (هللة)", hint: "تكلفة بالهللة لكل دقيقة صوت (تُقرّب للأعلى)، بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_hook: { label: "سعر هوك بالصورة في حيدرة كت (هللة)", hint: "تكلفة بالهللة لصورة GPT Image 2 مفرّغة؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_music: { label: "سعر دقيقة موسيقى في حيدرة كت (هللة)", hint: "تكلفة بالهللة، ElevenLabs Music؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_sfx: { label: "سعر المؤثر الصوتي في حيدرة كت (هللة)", hint: "تكلفة بالهللة، ElevenLabs؛ مؤثر دخول وخروج نص الهوك؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_upscale: { label: "سعر دقيقة رفع الدقة في حيدرة كت (هللة)", hint: "تكلفة بالهللة، Topaz عبر fal: ‎$0.08 لكل ثانية بدقة 4K و‎$0.02 بدقة 1080p؛ ٠ = متاح للمالك وحده (ما ينفتح لغيره بدون سعر)", default: 0, perUser: false },
  editor_price_stems: { label: "سعر دقيقة فصل الأصوات في حيدرة كت (هللة)", hint: "تكلفة بالهللة، كلام وموسيقى ومؤثرات؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
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

/** One price (for everyone). */
export async function getLimit(key: LimitKey) {
  const all = (await limitRows()).find((r) => r.key === key && r.scope === "all");
  return all?.value ?? LIMITS[key].default;
}
