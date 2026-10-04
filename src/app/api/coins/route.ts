import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTO_TOP_UP } from "@config/coins";

/**
 * The user's «النقود الذكية» settings:
 *   { action: "auto_topup", on, amountSar }  turn the automatic top-up on/off (charged once payments are connected)
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const body = (await req.json().catch(() => ({}))) as { action?: string; on?: boolean; amountSar?: unknown };
  if (body.action !== "auto_topup") throw new UserError("طلب غير معروف.", 400);
  const amount = Number(body.amountSar);
  if (!(AUTO_TOP_UP.amountsSar as readonly number[]).includes(amount)) throw new UserError("اختر مبلغ من الخيارات.", 400);
  const db = createAdminClient();
  await db.from("smart_coin_wallets").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  const { error } = await db
    .from("smart_coin_wallets")
    .update({ auto_topup: Boolean(body.on), auto_topup_sar: amount, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new UserError("الإعداد ما انحفظ. جرّب بعد شوي.", 500);
  return NextResponse.json({ ok: true });
});
