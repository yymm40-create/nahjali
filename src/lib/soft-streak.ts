// The count of a person's robot turns in a row spoiled by a content refusal or a busy provider (lib/platform-fault's
// SOFT_RULE: the first three are ours, then the person pays as usual). Kept in jawad_settings under
// "soft-faults:<user>" so every server sees the same count. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { nextSoft } from "@/lib/platform-fault";

const keyOf = (userId: string) => `soft-faults:${userId}`;
/** People this server knows have no count (so a turn that went through doesn't write each time). */
const clear = new Set<string>();

/** One more spoiled turn for this person now: whether it is ours (within the first three in a row). */
export async function softTurnIsOurs(userId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db.from("jawad_settings").select("value").eq("key", keyOf(userId)).maybeSingle();
  const v = (data?.value ?? null) as { count?: unknown; at?: unknown } | null;
  const prev = v && Number(v.count) > 0 && Number(v.at) > 0 ? { count: Number(v.count), at: Number(v.at) } : null;
  const next = nextSoft(prev);
  clear.delete(userId);
  await db.from("jawad_settings").upsert({ key: keyOf(userId), value: { count: next.count, at: next.at }, updated_at: new Date().toISOString(), updated_by: userId }).then(() => {}, () => {});
  return next.ours;
}

/** A turn went through: the count starts again (in the background; nothing waits on it). */
export function clearSoftStreak(userId: string) {
  if (clear.has(userId)) return;
  if (clear.size > 20_000) clear.clear();
  clear.add(userId);
  void createAdminClient().from("jawad_settings").delete().eq("key", keyOf(userId)).then(() => {}, () => clear.delete(userId));
}
