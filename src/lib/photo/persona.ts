// «زهراء» — the persona's text: the owner's edit (photo_kv) or the default template (config/photo.ts), and the whole
// system text of a conversation (persona + the platform's rules + the tools + the fonts). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_KV, PHOTO_PLATFORM_RULES, PHOTO_TOOLS, ZAHRAA_PERSONA } from "@config/photo";
import { FONTS } from "@config/jawad/student";

const db = () => createAdminClient();
const MAX = 80_000;

/** The persona now (the owner's edit when there is one), and whether it is an edit. */
export async function getPersona(): Promise<{ text: string; edited: boolean }> {
  const { data } = await db().from("photo_kv").select("value").eq("key", PHOTO_KV.persona).maybeSingle();
  const v = String(data?.value ?? "").trim();
  return v ? { text: v, edited: true } : { text: ZAHRAA_PERSONA, edited: false };
}

export async function savePersona(text: string) {
  const t = text.trim();
  if (t.length < 200) throw new Error("القالب قصير جدًا.");
  if (t.length > MAX) throw new Error(`القالب أطول من ${MAX} حرف.`);
  const { error } = await db().from("photo_kv").upsert({ key: PHOTO_KV.persona, value: t, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function resetPersona() {
  await db().from("photo_kv").delete().eq("key", PHOTO_KV.persona);
}

/** The site's Arabic fonts as «زهراء» names them in a layer (always the same text, so it caches). */
export function fontsBlock(): string {
  return `الخطوط العربية المتاحة (ضع المعرّف في "font"):\n${FONTS.map((f) => `- ${f.id} — ${f.label}: ${f.role}`).join("\n")}`;
}

export const fontIds = () => FONTS.map((f) => f.id);

/** The whole system text: the persona, what the platform requires, how the tools are reached, the fonts, the project's record. */
export function systemText(persona: string, parts: string[] = [], record = "") {
  return [persona, PHOTO_PLATFORM_RULES, PHOTO_TOOLS, fontsBlock(), ...parts, record ? `سجل المشروع الحالي (كما حُفظ؛ حدّثه في "record" عند أي تغيير):\n${record}` : ""].filter(Boolean).join("\n\n");
}
