// «محمد باقر» — the persona's text: the owner's edit (content_kv) or the default template (config/content.ts), and
// the whole system text of a conversation (persona + the platform's rules + the tools + the examples of the turn +
// the project's record). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { BAQIR_PERSONA, CONTENT_KV, CONTENT_PLATFORM_RULES, CONTENT_TOOLS } from "@config/content";

const db = () => createAdminClient();
const MAX = 80_000;

/** The persona now (the owner's edit when there is one), and whether it is an edit. */
export async function getPersona(): Promise<{ text: string; edited: boolean }> {
  const { data } = await db().from("content_kv").select("value").eq("key", CONTENT_KV.persona).maybeSingle();
  const v = String(data?.value ?? "").trim();
  return v ? { text: v, edited: true } : { text: BAQIR_PERSONA, edited: false };
}

export async function savePersona(text: string) {
  const t = text.trim();
  if (t.length < 200) throw new Error("القالب قصير جدًا.");
  if (t.length > MAX) throw new Error(`القالب أطول من ${MAX} حرف.`);
  const { error } = await db().from("content_kv").upsert({ key: CONTENT_KV.persona, value: t, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Back to the default template. */
export async function resetPersona() {
  await db().from("content_kv").delete().eq("key", CONTENT_KV.persona);
}

/**
 * The whole system text: the persona, what the platform requires, how its tools are reached, then (per turn) the
 * closest examples and the project's record.
 */
export function systemText(persona: string, examples = "", record = "") {
  return [persona, CONTENT_PLATFORM_RULES, CONTENT_TOOLS, examples, record ? `سجل المشروع الحالي (كما حفظته آخر مرة؛ حدّثه في "record" عند أي تغيير):\n${record}` : ""].filter(Boolean).join("\n\n");
}
