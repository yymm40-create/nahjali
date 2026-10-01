import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
import {
  ATTEMPTS_ALLOWED,
  FREE_TRIAL,
  FREE_TRIAL_DAILY_LIMIT,
  FREE_TRIAL_MAX_ORDERS,
  isQuality,
  QUALITY_TIERS,
} from "@config/pricing";

/**
 * Creates a new order for the chosen template and quality tier.
 * Free trial: the order starts as "paid" (no payment step), limited per account.
 * Otherwise it starts as "pending_payment".
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { templateId, quality } = (await req.json().catch(() => ({}))) as { templateId?: string; quality?: string };
  const template = templateId ? await getTemplate(templateId) : null;
  if (!template) throw new UserError("القالب غير موجود.", 400);
  if (!isQuality(quality)) throw new UserError("اختر الجودة.", 400);

  const db = createAdminClient();
  if (FREE_TRIAL) {
    const { count } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_trial", true);
    if ((count ?? 0) >= FREE_TRIAL_MAX_ORDERS) {
      throw new UserError(`استخدمت التجارب المجانية المتاحة لحسابك (${FREE_TRIAL_MAX_ORDERS}).`, 403);
    }

    // Midnight in Riyadh (UTC+3), expressed in UTC
    const now = new Date();
    const riyadh = new Date(now.getTime() + 3 * 3600_000);
    const dayStart = new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate()) - 3 * 3600_000);
    const { count: today } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("is_trial", true)
      .gte("created_at", dayStart.toISOString());
    if ((today ?? 0) >= FREE_TRIAL_DAILY_LIMIT) {
      throw new UserError("وصلنا للحد اليومي للتجارب المجانية. جرّب بكرة إن شاء الله.", 429);
    }
  }

  const { data, error } = await db
    .from("orders")
    .insert({
      user_id: user.id,
      template_id: template.id,
      quality,
      amount_halalas: QUALITY_TIERS[quality].price_halalas,
      attempts_allowed: ATTEMPTS_ALLOWED,
      is_trial: FREE_TRIAL,
      status: FREE_TRIAL ? "paid" : "pending_payment",
    })
    .select("id")
    .single();
  if (error) throw error;

  return NextResponse.json({
    id: data.id,
    next: FREE_TRIAL ? `/order/${data.id}/upload` : `/new?order=${data.id}`,
  });
});
