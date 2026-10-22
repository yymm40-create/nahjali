import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { settlePaylinkOrder } from "@/lib/credits/orders";

export const dynamic = "force-dynamic";

/**
 * Paylink's «Payment Webhook» (set in my.paylink.sa → الإعدادات → PAYMENT WEBHOOK, v1 or v2): called when an order is paid, even
 * when the buyer closed the page before coming back. Body: { merchantOrderNumber, transactionNo, orderStatus, amount, … }.
 * Nothing in it is trusted: the order id is taken, the invoice is READ from Paylink, and only a paid one for that order and price
 * adds the balance (once, however many times Paylink retries). Optional shared secret: PAYLINK_WEBHOOK_SECRET, sent by Paylink as
 * the header «X-Webhook-Secret» (the «HTTP Header 1» fields there).
 */
export async function POST(req: Request) {
  const secret = process.env.PAYLINK_WEBHOOK_SECRET?.trim();
  if (secret) {
    const got = Buffer.from(req.headers.get("x-webhook-secret") ?? "");
    const want = Buffer.from(secret);
    if (got.length !== want.length || !timingSafeEqual(got, want)) return NextResponse.json({ ok: false }, { status: 401 });
  }
  const b = (await req.json().catch(() => ({}))) as { merchantOrderNumber?: unknown; orderNumber?: unknown };
  const id = String(b.merchantOrderNumber ?? b.orderNumber ?? "");
  const r = await settlePaylinkOrder(id).catch((e) => {
    console.error("paylink webhook", id, e);
    return null;
  });
  // 200 even when it is not ours or not paid yet: Paylink retries only on errors, and the return page settles it too
  return NextResponse.json({ ok: true, paid: !!r?.paid });
}
