import { NextResponse } from "next/server";
import { settleCardOrder } from "@/lib/course/orders";

export const dynamic = "force-dynamic";

/**
 * The invoice's callback_url: Moyasar POSTs here when it is paid, even when the buyer closed the page before coming back. Nothing in
 * the body is trusted: the order id is in our own URL, the invoices are READ from Moyasar by the ids we saved, and only a paid one for
 * that order and price unlocks it (once, however many times this is called).
 */
export async function POST(req: Request) {
  const id = new URL(req.url).searchParams.get("order") ?? "";
  const r = await settleCardOrder(id).catch((e) => {
    console.error("moyasar course webhook", id, e);
    return null;
  });
  return NextResponse.json({ ok: true, paid: !!r?.paid });
}
