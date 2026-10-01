import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

/** Error with an Arabic, user-facing message and an HTTP status. */
export class UserError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export const MESSAGES = {
  unauthenticated: "لازم تسجّل دخولك أول.",
  notFound: "ما لقينا هذا الطلب.",
  notPaid: "هذا الطلب ما تم دفعه بعد.",
  noAttempts: "استخدمت كل محاولات التوليد المتاحة.",
  wrongStep: "هذي الخطوة مو متاحة الحين لهذا الطلب.",
  busy: "فيه عملية شغالة على هذا الطلب، انتظر شوي.",
  rateLimited: "طلبات كثيرة خلال وقت قصير، جرّب بعد دقائق.",
  generationFailed: "صار خطأ أثناء توليد الصورة. جرّب مرة ثانية.",
  badImage: "الصورة لازم تكون JPG أو PNG أو WEBP وحجمها أقل من ١٠ ميجا.",
  noSource: "ارفع صورتك أول.",
  unexpected: "صار خطأ غير متوقع. جرّب مرة ثانية.",
} as const;

/** Wraps a route handler: converts UserError to JSON and hides unexpected errors from the user. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UserError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      return NextResponse.json({ error: MESSAGES.unexpected }, { status: 500 });
    }
  };
}

export async function requireApiUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UserError(MESSAGES.unauthenticated, 401);
  return user;
}

/** Loads an order with the admin client and verifies the user owns it. */
export async function getOwnedOrder(orderId: string, userId: string): Promise<Order> {
  const { data } = await createAdminClient().from("orders").select("*").eq("id", orderId).maybeSingle();
  if (!data || data.user_id !== userId) throw new UserError(MESSAGES.notFound, 404);
  return data as Order;
}
