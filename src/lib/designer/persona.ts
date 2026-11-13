// «كاظم» — the persona's text: the owner's edit (designer_kv) or the default template (config/designer.ts), and the
// whole system text of a conversation (persona + the platform's rules + the tools + the fonts + the style library
// + the project's record). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { DESIGNER_KV, DESIGNER_PLATFORM_RULES, DESIGNER_TOOLS, KAZEM_PERSONA } from "@config/designer";
import { HUSSEINI_MOURNING_FEED } from "@config/husseini-mourning";
import { CONTENT_FONTS } from "@config/content-fonts";
import { DESIGNER_EDIT_RULES, DESIGNER_TALK_RULES } from "@config/designer-talk";

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

/** «قائمة الخطوط» (the same 50 Arabic fonts as «صانع المحتوى»), as «كاظم» names them (always the same text, so it caches). */
export function fontsBlock(): string {
  return `قائمة الخطوط (٥٠ خطًا عربيًا؛ ضع المعرّف في "font" وفي كل طبقة؛ kind="fonts" يعرضها للعميل بشكلها):\n${CONTENT_FONTS.map((f) => `- ${f.id} — ${f.name} (${f.group}): ${f.feel}؛ يناسب ${f.bestFor}`).join("\n")}`;
}

/**
 * The whole system text: the persona, what the platform requires, how its tools are reached, the talk and the edits
 * (as «صانع المحتوى» has them), the fonts, the Husseini feed, then the project's record.
 */
export function systemText(persona: string, parts: string[] = [], record = "") {
  return [persona, DESIGNER_PLATFORM_RULES, DESIGNER_TOOLS, DESIGNER_TALK_RULES, DESIGNER_EDIT_RULES, fontsBlock(), HUSSEINI_MOURNING_FEED, ...parts, recordText(record)].filter(Boolean).join("\n\n");
}

const recordText = (record: string) => (record ? `سجل المشروع الحالي (كما حفظته آخر مرة؛ حدّثه في "record" عند أي تغيير):\n${record}` : "");

/** What changes from one message to the next (examples, the record): read with this turn, not in the system (cached). */
export function turnText(parts: string[] = [], record = "") {
  return [...parts, recordText(record)].filter(Boolean).join("\n\n");
}
