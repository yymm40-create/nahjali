// «🔴 النقود الحمراء» — the owner's list of e-mails that pay the platform's own price (/admin/access): everything they buy
// costs exactly what the provider charges us (Claude: its real input, cache and output tokens), with no profit and no
// rounding up to half a riyal — only to the halala, the wallet's smallest unit. Their coin is RED everywhere. Kept in
// jawad_settings under "at_cost_emails" (no migration needed). Server only.

import { createAdminClient } from "@/lib/supabase/admin";

const KEY = "at_cost_emails";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
let memo: { at: number; emails: string[] } | null = null;
const TTL = 15_000;

/** The e-mails, lower-cased, no repeats, only well-formed ones. */
export const normalizeAtCostEmails = (v: unknown): string[] =>
  Array.isArray(v) ? [...new Set(v.map((e) => String(e ?? "").trim().toLowerCase()).filter((e) => EMAIL_RE.test(e) && e.length <= 254))] : [];

/** Every e-mail on the list (empty when never set, or the settings can't be read); `fresh` skips the short memory (the dashboard). */
export async function atCostEmails(fresh = false): Promise<string[]> {
  if (!fresh && memo && Date.now() - memo.at < TTL) return memo.emails;
  const { data, error } = await createAdminClient().from("jawad_settings").select("value").eq("key", KEY).maybeSingle();
  if (error) return [];
  const emails = normalizeAtCostEmails((data?.value as { emails?: unknown } | null)?.emails);
  memo = { at: Date.now(), emails };
  return emails;
}

/** Whether this e-mail pays the platform's own price (red coin). */
export const isAtCostEmail = async (email: string | null | undefined) => {
  const mail = email?.trim().toLowerCase();
  return mail ? (await atCostEmails()).includes(mail) : false;
};

/** Adds (`on`) or removes one e-mail; returns the list after the change. */
export async function setAtCostEmail(email: string, on: boolean, by: string): Promise<string[]> {
  memo = null;
  const mail = email.trim().toLowerCase();
  const now = await atCostEmails(true);
  const emails = on ? normalizeAtCostEmails([...now, mail]) : now.filter((e) => e !== mail);
  const { error } = await createAdminClient().from("jawad_settings").upsert({ key: KEY, value: { emails }, updated_at: new Date().toISOString(), updated_by: by });
  if (error) throw error;
  memo = { at: Date.now(), emails };
  return emails;
}
