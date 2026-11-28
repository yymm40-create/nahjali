// The person's «نسخة GPT Image» (config/jawad/gpt-image.ts), kept for their account in jawad_settings under
// "gpt-image:<user>": the film maker, the smart student and the other places that paint with GPT Image follow it.
// GPT Image 2 until they pick another. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { isGptImagePick, type GptImagePick } from "@config/jawad/gpt-image";

const keyOf = (userId: string) => `gpt-image:${userId}`;
const memo = new Map<string, { at: number; pick: GptImagePick }>();
const TTL = 30_000;

/** This person's pick (GPT Image 2 when none, or the settings can't be read). */
export async function gptImagePickOf(userId: string | null | undefined): Promise<GptImagePick> {
  if (!userId) return "2";
  const hit = memo.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.pick;
  const { data } = await createAdminClient().from("jawad_settings").select("value").eq("key", keyOf(userId)).maybeSingle();
  const v = (data?.value as { pick?: unknown } | null)?.pick;
  const pick = isGptImagePick(v) ? v : "2";
  if (memo.size > 5000) memo.clear();
  memo.set(userId, { at: Date.now(), pick });
  return pick;
}

export async function setGptImagePick(userId: string, pick: GptImagePick) {
  const { error } = await createAdminClient().from("jawad_settings").upsert({ key: keyOf(userId), value: { pick }, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) throw error;
  memo.set(userId, { at: Date.now(), pick });
}
