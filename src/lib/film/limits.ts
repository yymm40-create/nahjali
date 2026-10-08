// «حيدرة كت»'s prices in coins, set by the owner from /admin/limits (used only once «النقود الذكية مطلوبة» is on).
// Who may use what, free and without limits, is the dashboard's one list instead (src/lib/access.ts).
// Until the film_limits table exists (migration 0014), the defaults below apply.

import { createAdminClient } from "@/lib/supabase/admin";

export const LIMITS = {
  editor_price_claude: { label: "سعر طلب Claude في حيدرة كت (نقدة)", hint: "يُخصم بس إذا شغّلت «النقود الذكية مطلوبة»؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_voice: { label: "سعر رد حيدرة بالصوت في حيدرة كت (نقدة)", hint: "لكل رد ينقرأ بصوت حيدرة (ElevenLabs)؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_caption: { label: "سعر دقيقة الكابشن في حيدرة كت (نقدة)", hint: "لكل دقيقة صوت (تُقرّب للأعلى)، بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_hook: { label: "سعر هوك بالصورة في حيدرة كت (نقدة)", hint: "صورة GPT Image 2 مفرّغة؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_music: { label: "سعر دقيقة موسيقى في حيدرة كت (نقدة)", hint: "ElevenLabs Music؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_sfx: { label: "سعر المؤثر الصوتي في حيدرة كت (نقدة)", hint: "ElevenLabs؛ مؤثر دخول وخروج نص الهوك؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
  editor_price_upscale: { label: "سعر دقيقة رفع الدقة في حيدرة كت (نقدة)", hint: "Topaz عبر fal: ‎$0.08 لكل ثانية بدقة 4K و‎$0.02 بدقة 1080p؛ ٠ = متاح للمالك وحده (ما ينفتح لغيره بدون سعر)", default: 0, perUser: false },
  editor_price_stems: { label: "سعر دقيقة فصل الأصوات في حيدرة كت (نقدة)", hint: "كلام وموسيقى ومؤثرات؛ بس إذا النقود مطلوبة؛ ٠ = مجاني", default: 0, perUser: false },
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
