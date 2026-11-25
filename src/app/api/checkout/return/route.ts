import { NextResponse } from "next/server";
import { settleFormPayment } from "@/lib/credits/checkout-settle";

export const dynamic = "force-dynamic";

/**
 * The form's callback_url: Moyasar sends the buyer here after paying (with `id`, `status`, `message`). Only the payment id is used:
 * the payment is READ from Moyasar and settled by its metadata (src/lib/credits/checkout-settle.ts); `k` (and `r`, the ref of a
 * free-amount payment) only picks the page to go back to when the payment cannot be read.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const r = await settleFormPayment(q.get("id") ?? "", q.get("k") ?? "", q.get("r") ?? "").catch((e) => {
    console.error("checkout return", e);
    return { to: "/jawad-ai" };
  });
  return NextResponse.redirect(new URL(r.to, req.url), 303);
}
