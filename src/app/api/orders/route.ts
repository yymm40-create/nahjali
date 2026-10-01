import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTemplate } from "@/lib/templates";
import { ATTEMPTS_ALLOWED, PRICE_HALALAS } from "@config/pricing";

/** Creates a new order (status pending_payment) for the chosen template. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { templateId } = (await req.json().catch(() => ({}))) as { templateId?: string };
  const template = templateId ? await getTemplate(templateId) : null;
  if (!template) throw new UserError("القالب غير موجود.", 400);

  const { data, error } = await createAdminClient()
    .from("orders")
    .insert({
      user_id: user.id,
      template_id: template.id,
      amount_halalas: PRICE_HALALAS,
      attempts_allowed: ATTEMPTS_ALLOWED,
    })
    .select("id")
    .single();
  if (error) throw error;
  return NextResponse.json({ id: data.id });
});
