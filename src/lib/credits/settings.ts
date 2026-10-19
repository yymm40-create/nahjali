// «اشحن رصيدك» — the owner's packages and WhatsApp number (jawad_settings, key "credits"). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CREDIT_SETTINGS, DEFAULT_PACKS, readCreditSettings, type CreditSettings } from "@config/credits";

const KEY = "credits";

export async function loadCreditSettings(): Promise<CreditSettings> {
  const { data, error } = await createAdminClient().from("jawad_settings").select("value").eq("key", KEY).maybeSingle();
  if (error || !data) return DEFAULT_CREDIT_SETTINGS;
  return readCreditSettings(data.value);
}

export async function saveCreditSettings(patch: Partial<Record<keyof CreditSettings, unknown>>, by: string): Promise<CreditSettings> {
  const cur = await loadCreditSettings();
  // a built-in package missing from the list the owner saves was deleted by him: it stays deleted
  const removed = Array.isArray(patch.packs)
    ? DEFAULT_PACKS.map((p) => p.id).filter((id) => !(patch.packs as { id?: unknown }[]).some((x) => x && x.id === id))
    : cur.removed;
  const next = readCreditSettings({ ...cur, ...patch, removed });
  const { error } = await createAdminClient().from("jawad_settings").upsert({ key: KEY, value: next, updated_at: new Date().toISOString(), updated_by: by.slice(0, 120) });
  if (error) throw error;
  return next;
}
