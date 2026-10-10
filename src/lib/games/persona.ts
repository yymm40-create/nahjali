// «قنبر» — the persona's text: the owner's edit (games_kv) or the default template (config/games.ts), and the whole
// system text of a conversation (persona + the platform's rules + the library notes of the games named). Server only.

import { OPTIONS_RULE } from "@/lib/chat-options";
import { createAdminClient } from "@/lib/supabase/admin";
import { GAMES_KV, GAMES_MODE_RULES, GAMES_PLATFORM_RULES, QANBAR_PERSONA, type GamesMode } from "@config/games";

const db = () => createAdminClient();
const MAX = 60_000;

/** The persona now (the owner's edit when there is one), and whether it is an edit. */
export async function getPersona(): Promise<{ text: string; edited: boolean }> {
  const { data } = await db().from("games_kv").select("value").eq("key", GAMES_KV.persona).maybeSingle();
  const v = String(data?.value ?? "").trim();
  return v ? { text: v, edited: true } : { text: QANBAR_PERSONA, edited: false };
}

export async function savePersona(text: string) {
  const t = text.trim();
  if (t.length < 200) throw new Error("القالب قصير جدًا.");
  if (t.length > MAX) throw new Error(`القالب أطول من ${MAX} حرف.`);
  const { error } = await db().from("games_kv").upsert({ key: GAMES_KV.persona, value: t, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Back to the default template. */
export async function resetPersona() {
  await db().from("games_kv").delete().eq("key", GAMES_KV.persona);
}

/**
 * The whole system text: persona, then what the platform requires (the rules, the way the person chose — the game built
 * here or a prompt to take elsewhere — and the clickable answers every chat ends with), then the library notes (when games
 * were named).
 */
export function systemText(persona: string, libraryBlock = "", mode: GamesMode = "") {
  return [persona, GAMES_PLATFORM_RULES, mode ? GAMES_MODE_RULES[mode] : "", OPTIONS_RULE, libraryBlock].filter(Boolean).join("\n\n");
}
