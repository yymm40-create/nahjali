import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
import { deleteExpiredSourcePhotos } from "@/lib/orders";
import { isStyle } from "@config/styles";
import {
  ATTEMPTS_ALLOWED,
  FREE_TRIAL,
  dailyTrialLimit,
  hasUnlimitedTrials,
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
  const body = (await req.json().catch(() => ({}))) as {
    templateId?: string;
    quality?: string;
    style?: string;
    childName?: string;
    gender?: string;
    parentMessage?: string;
  };
  const { templateId, quality, style, gender } = body;
  // Printed in the booklet: letters (Arabic/Latin) and single spaces only
  const childName = (body.childName ?? "").replace(/\s+/g, " ").trim();
  // Optional, printed in the booklet: no control characters, max 140
  const parentMessage = (body.parentMessage ?? "").replace(/[\p{Cc}\p{Cf}]/gu, " ").replace(/\s+/g, " ").trim();
  const template = templateId ? await getTemplate(templateId) : null;
  if (!template) throw new UserError("القالب غير موجود.", 400);
  if (!isQuality(quality)) throw new UserError("اختر الجودة.", 400);
  if (!QUALITY_TIERS[quality].available) throw new UserError("هذي الجودة غير متوفرة حاليًا.", 400);
  if (!isStyle(style)) throw new UserError("اختر الستايل.", 400);
  if (gender !== "boy" && gender !== "girl") throw new UserError("اختر ولد أو بنت.", 400);
  if (!/^[\p{L}\p{M} ]{1,30}$/u.test(childName)) throw new UserError("اكتب اسم الطفل بالحروف فقط (٣٠ حرف كحد أقصى).", 400);
  if (parentMessage.length > 140) throw new UserError("رسالة الأهل طويلة (١٤٠ حرف كحد أقصى).", 400);

  const db = createAdminClient();
  if (FREE_TRIAL && !hasUnlimitedTrials(user.email)) {
    const { count } = await db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_trial", true);
    const limit = dailyTrialLimit(user);
    if ((count ?? 0) >= limit) {
      throw new UserError(`استخدمت التجربة المجانية المتاحة لحسابك (${limit}).`, 403);
    }
  }

  const { data, error } = await db
    .from("orders")
    .insert({
      user_id: user.id,
      template_id: template.id,
      quality,
      style,
      child_name: childName,
      child_gender: gender,
      parent_message: parentMessage || null,
      amount_halalas: QUALITY_TIERS[quality].price_halalas,
      attempts_allowed: ATTEMPTS_ALLOWED,
      is_trial: FREE_TRIAL,
      status: FREE_TRIAL ? "paid" : "pending_payment",
    })
    .select("id")
    .single();
  if (error) throw error;
  // Counted again after saving: several orders sent at the same moment can't all pass the check above
  if (FREE_TRIAL && !hasUnlimitedTrials(user.email)) {
    const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_trial", true);
    const limit = dailyTrialLimit(user);
    if ((count ?? 0) > limit) {
      await db.from("orders").delete().eq("id", data.id);
      throw new UserError(`استخدمت التجربة المجانية المتاحة لحسابك (${limit}).`, 403);
    }
  }

  // Also run the photo clean-up opportunistically (the daily cron is the backstop)
  await deleteExpiredSourcePhotos();

  return NextResponse.json({
    id: data.id,
    next: FREE_TRIAL ? `/order/${data.id}/upload` : `/new?order=${data.id}`,
  });
});
