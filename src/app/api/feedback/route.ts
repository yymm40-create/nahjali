import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/** Saves a customer's rating (1–5) and optional comment for the owner's dashboard. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const body = (await req.json().catch(() => ({}))) as { rating?: number; message?: string; orderId?: string };
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new UserError("اختر تقييم من ١ إلى ٥ نجوم.", 400);
  const message = (body.message ?? "").replace(/[\p{Cc}]/gu, " ").trim().slice(0, 1000);

  const db = createAdminClient();
  // Only link orders that belong to this user
  let orderId: string | null = null;
  if (body.orderId) {
    const { data } = await db.from("orders").select("id").eq("id", body.orderId).eq("user_id", user.id).maybeSingle();
    orderId = data?.id ?? null;
  }

  const { error } = await db.from("feedback").insert({ user_id: user.id, order_id: orderId, rating, message: message || null });
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
