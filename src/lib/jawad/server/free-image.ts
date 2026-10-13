// One first image for accounts created after migration 0070. The user's creation time comes from Supabase Auth;
// usage is claimed atomically with job creation by jawad_create_job.
import { createAdminClient } from "@/lib/supabase/admin";

const CAMPAIGN_KEY = "signup-free-image";

export async function signupFreeImageEligible(createdAt: string | null | undefined): Promise<boolean> {
  if (!createdAt) return false;
  const { data, error } = await createAdminClient().from("jawad_settings").select("value").eq("key", CAMPAIGN_KEY).maybeSingle();
  if (error || !data || typeof data.value !== "object" || data.value === null) return false;
  const startedAt = (data.value as { started_at?: unknown }).started_at;
  const startMs = typeof startedAt === "string" ? Date.parse(startedAt) : Number.NaN;
  const createdMs = Date.parse(createdAt);
  return Number.isFinite(startMs) && Number.isFinite(createdMs) && createdMs >= startMs;
}

export async function signupFreeImageAvailable(userId: string, createdAt: string | null | undefined): Promise<boolean> {
  if (!(await signupFreeImageEligible(createdAt))) return false;
  const { data, error } = await createAdminClient().from("jawad_free_image_trials").select("user_id").eq("user_id", userId).maybeSingle();
  return !error && !data;
}
