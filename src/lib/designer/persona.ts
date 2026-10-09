// «كاظم» — the persona's text: the owner's edit (designer_kv) or the default template (config/designer.ts), and the
// whole system text of a conversation (persona + the platform's rules + the tools + the fonts + the style library
// + the project's record). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { DESIGNER_KV, DESIGNER_PLATFORM_RULES, DESIGNER_TOOLS, KAZEM_PERSONA } from "@config/designer";
import { libraryBlock } from "@config/designer-library";
import { FONTS } from "@config/jawad/student";

const db = () => createAdminClient();
const MAX = 80_000;

/** The persona now (the owner's edit when there is one), and whether it is an edit. */
export async function getPersona(): Promise<{ text: string; edited: boolean }> {
  const { data } = await db().from("designer_kv").select("value").eq("key", DESIGNER_KV.persona).maybeSingle();
  const v = String(data?.value ?? "").trim();
  return v ? { text: v, edited: true } : { text: KAZEM_PERSONA, edited: false };
}

export async function savePersona(text: string) {
  const t = text.trim();
  if (t.length < 200) throw new Error("القالب قصير جدًا.");
  if (t.length > MAX) throw new Error(`القالب أطول من ${MAX} حرف.`);
  const { error } = await db().from("designer_kv").upsert({ key: DESIGNER_KV.persona, value: t, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Back to the default template. */
export async function resetPersona() {
  await db().from("designer_kv").delete().eq("key", DESIGNER_KV.persona);
}

/** The site's Arabic fonts, as «كاظم» names them in a layer (always the same text, so it caches). */
export function fontsBlock(): string {
  return `الخطوط العربية المتاحة (ضع المعرّف في "font" لكل طبقة؛ معرض kind="fonts" يعرضها للعميل بشكلها):\n${FONTS.map((f) => `- ${f.id} — ${f.label}: ${f.role}`).join("\n")}`;
}

/**
 * The whole system text: the persona, what the platform requires, how its tools are reached, the fonts, the style
 * library, then the project's record.
 */
export function systemText(persona: string, parts: string[] = [], record = "") {
  return [persona, DESIGNER_PLATFORM_RULES, DESIGNER_TOOLS, fontsBlock(), libraryBlock(), ...parts, record ? `سجل المشروع الحالي (كما حفظته آخر مرة؛ حدّثه في "record" عند أي تغيير):\n${record}` : ""].filter(Boolean).join("\n\n");
}
