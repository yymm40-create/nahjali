// «محمد الخارق» — the persona's text: the owner's edit (kharq_kv) or the default template (config/kharq.ts), and the
// whole system text of a conversation (persona + the platform's rules + the site's branches + his own record so far).
// Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { KHARQ_KV, KHARQ_PERSONA, KHARQ_PLATFORM_RULES, roadsBlock } from "@config/kharq";

const db = () => createAdminClient();
const MAX = 60_000;

/** The persona now (the owner's edit when there is one), and whether it is an edit. */
export async function getPersona(): Promise<{ text: string; edited: boolean }> {
  const { data } = await db().from("kharq_kv").select("value").eq("key", KHARQ_KV.persona).maybeSingle();
  const v = String(data?.value ?? "").trim();
  return v ? { text: v, edited: true } : { text: KHARQ_PERSONA, edited: false };
}

export async function savePersona(text: string) {
  const t = text.trim();
  if (t.length < 200) throw new Error("القالب قصير جدًا.");
  if (t.length > MAX) throw new Error(`القالب أطول من ${MAX} حرف.`);
  const { error } = await db().from("kharq_kv").upsert({ key: KHARQ_KV.persona, value: t, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Back to the default template. */
export async function resetPersona() {
  await db().from("kharq_kv").delete().eq("key", KHARQ_KV.persona);
}

/** His own record so far, given back to him each turn — the template he wrote and now embodies. */
export const briefBlock = (brief: string) =>
  brief.trim()
    ? `قالبك الداخلي لهذا المشروع (أنت كتبته، وأنت متقمّصه الآن؛ العميل لا يراه). التزم به، وأعد إرساله في «brief» محدّثًا بما جدّ:\n\n${brief.trim()}`
    : "ما كتبت قالبك الداخلي لهذا المشروع بعد: اجمع ما تحتاجه بالأسئلة أولًا، وأول ما تكفي المعلومات اكتبه في «brief».";

/**
 * The whole system text: persona, then what the platform requires, the branches he may point to, and his own record.
 */
export function systemText(persona: string, brief = "", extra = "") {
  return [persona, KHARQ_PLATFORM_RULES, roadsBlock(), briefBlock(brief), extra].filter(Boolean).join("\n\n");
}
