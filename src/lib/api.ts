import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

/** Error with an Arabic, user-facing message and an HTTP status (and, for the page, extra fields sent beside `error`). */
export class UserError extends Error {
  constructor(
    message: string,
    public status = 400,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

/**
 * «خلص رصيدك» (the owner, 26 October 2026): what a page needs to offer a top-up of exactly what this operation takes.
 * `need` and `balance` in halalas; `what` names the operation («هالصورة», «هالرد»…). The site's sheet (TopUpSheet) opens
 * on any 402 that carries it, with «ادفع بمقداره بس» and the packages.
 */
export interface TopUp {
  need: number;
  balance: number;
  what: string;
}
const sar = (h: number) => {
  const n = Math.round(Math.max(0, h)) / 100;
  return `¤${Number.isInteger(n) ? n : n.toFixed(2)}`;
};
/** The refusal of an operation the wallet can't pay for, with what it needs (the page offers to pay just that). */
export function shortBalance(need: number, balance: number | null | undefined, what = "هالعملية", message?: string) {
  const topup: TopUp = { need: Math.max(1, Math.ceil(need)), balance: Math.round(balance ?? 0), what };
  return new UserError(message ?? `خلص رصيدك: تكلفة ${what} ${sar(topup.need)}${topup.balance > 0 ? ` ورصيدك ${sar(topup.balance)}` : ""}. اشحن بمقدارها بس أو اختر باقة.`, 402, { topup });
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
      if (err instanceof UserError) return NextResponse.json({ ...(err.data ?? {}), error: err.message }, { status: err.status });
      console.error(err);
      // a file that couldn't be saved or read (storage answers { message } objects, R2 errors start with "R2"):
      // say so, with its reason, instead of a bare «غير متوقع»
      const why = String((err as { message?: unknown } | null)?.message ?? "");
      if (why && (!(err instanceof Error) || /^R2\b/.test(why))) return NextResponse.json({ error: `تعذّر حفظ أو قراءة الملف (${why.slice(0, 160)}). جرّب مرة ثانية.` }, { status: 500 });
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
