import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGES, UserError } from "@/lib/api";
import { GENERATION_SETTINGS } from "@config/prompts";
import { ESTIMATED_COST_USD, RATE_LIMIT } from "@config/pricing";

/** Throws if the user started too many generations recently (counted from generation_logs). */
export async function checkRateLimit(userId: string) {
  const db = createAdminClient();
  const { data: orders } = await db.from("orders").select("id").eq("user_id", userId);
  const ids = (orders ?? []).map((o) => o.id);
  if (ids.length === 0) return;

  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000).toISOString();
  const { count } = await db
    .from("generation_logs")
    .select("id", { count: "exact", head: true })
    .in("order_id", ids)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT.maxRequests) throw new UserError(MESSAGES.rateLimited, 429);
}

/** Records every generation (success or failure) for cost tracking. */
export async function logGeneration(orderId: string, type: "character" | "pose", success: boolean, error?: unknown) {
  await createAdminClient()
    .from("generation_logs")
    .insert({
      order_id: orderId,
      type,
      model: GENERATION_SETTINGS.model,
      quality: GENERATION_SETTINGS.quality,
      estimated_cost_usd: success ? (ESTIMATED_COST_USD[GENERATION_SETTINGS.quality] ?? 0) : 0,
      success,
      error: error ? String(error instanceof Error ? error.message : error).slice(0, 1000) : null,
    });
}
