import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGES, UserError } from "@/lib/api";
import { GENERATION_SETTINGS, HAIR_CHECK, type Gender } from "@config/prompts";
import { hairVisible } from "@/lib/openai";
import { ESTIMATED_COST_USD, RATE_LIMIT, type QualityKey } from "@config/pricing";

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
export async function logGeneration(
  orderId: string,
  type: "character" | "pose",
  quality: QualityKey,
  success: boolean,
  error?: unknown,
) {
  await createAdminClient()
    .from("generation_logs")
    .insert({
      order_id: orderId,
      type,
      model: GENERATION_SETTINGS.model,
      quality,
      estimated_cost_usd: success ? ESTIMATED_COST_USD[quality] : 0,
      success,
      error: error ? String(error instanceof Error ? error.message : error).slice(0, 1000) : null,
    });
}

/**
 * Girls must never show any hair (full abaya). Every girl picture is checked by an image-reading model before it is
 * kept: one with hair is thrown away and made again (HAIR_CHECK.retries), and if it still shows hair the
 * generation fails (the attempt is not used up, so the parent can simply try again).
 * If the check itself can't run, the picture is kept and the problem is logged.
 */
export async function withHairCheck(
  gender: Gender,
  kind: "character" | "pose",
  orderId: string,
  quality: QualityKey,
  make: () => Promise<Buffer>,
): Promise<Buffer> {
  let image = await make();
  if (gender !== "girl") return image;
  for (let extra = 0; ; extra++) {
    if ((await hairVisible(image)) !== true) return image;
    await logGeneration(orderId, kind, quality, true, "rejected: hair visible"); // it still cost money
    if (extra >= HAIR_CHECK.retries[kind]) throw new Error("hair visible in the girl's picture");
    image = await make();
  }
}
