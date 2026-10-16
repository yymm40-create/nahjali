// «أول تجربة مجانية»: whether this account's first attempt on a branch is still free (the offer is open and no earlier
// attempt on that branch, other than one that failed, was made). Server only.

import { freeFirstOpen } from "@config/jawad/free-first";
import { createAdminClient } from "@/lib/supabase/admin";

/** `prefix`: the idempotency prefix of the branch's jobs («cartoon_» or «zaynab_»). */
export async function freeFirstEligible(userId: string, prefix: string): Promise<boolean> {
  if (!freeFirstOpen()) return false;
  const { data, error } = await createAdminClient().from("jawad_jobs").select("id").eq("user_id", userId).like("idempotency_key", prefix + "%").neq("status", "failed").limit(1);
  if (error) return false;
  return !(data ?? []).length;
}
