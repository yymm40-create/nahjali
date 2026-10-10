// «اشحن رصيدك» — the owner's packages and WhatsApp number (jawad_settings, key "credits"). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_CREDIT_SETTINGS, readCreditSettings, type CreditSettings } from "@config/credits";

const KEY = "credits";

export async function loadCreditSettings(): Promise<CreditSettings> {
  const { data, error } = await createAdminClient().from("jawad_settings").select("value").eq("key", KEY).maybeSingle();
  if (error || !data) return DEFAULT_CREDIT_SETTINGS;
  return readCreditSettings(data.value);
}

export async function saveCreditSettings(patch: Partial<Record<keyof CreditSettings, unknown>>, by: string): Promise<CreditSettings> {
  const cur = await loadCreditSettings();
  const next = readCreditSettings({ ...cur, ...patch });
  const { error } = await createAdminClient().from("jawad_settings").upsert({ key: KEY, value: next, updated_at: new Date().toISOString(), updated_by: by.slice(0, 120) });
  if (error) throw error;
  return next;
}
