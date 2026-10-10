// «فتح الموقع للجميع» — the owner's launch switch (/admin, stored in jawad_settings under "public_open"). Off: only those «السماح»
// lets in see JAWAD AI (the rest see «قيد التطوير»). On: every visitor sees the site and every signed-in person may use every
// section (each generation paid from their wallet), except «الذكاء الإسلامي» (the owners only) and the hidden «نهج علي».
// Server only.

import { createAdminClient } from "@/lib/supabase/admin";

const KEY = "public_open";
let memo: { at: number; on: boolean } | null = null;
const TTL = 15_000;

export async function isPublicOpen(): Promise<boolean> {
  if (memo && Date.now() - memo.at < TTL) return memo.on;
  const { data, error } = await createAdminClient().from("jawad_settings").select("value").eq("key", KEY).maybeSingle();
  const on = !error && (data?.value === true || (data?.value as { on?: unknown } | null)?.on === true);
  memo = { at: Date.now(), on };
  return on;
}

export async function setPublicOpen(on: boolean, by: string) {
  const { error } = await createAdminClient().from("jawad_settings").upsert({ key: KEY, value: { on }, updated_at: new Date().toISOString(), updated_by: by });
  if (error) throw error;
  memo = { at: Date.now(), on };
}
