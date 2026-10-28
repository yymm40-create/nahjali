import { NextResponse } from "next/server";
import { settleMoyasarOrder } from "@/lib/credits/orders";

export const dynamic = "force-dynamic";

/**
 * The invoice's callback_url: Moyasar POSTs the invoice here when it is paid, even when the buyer closed the page before coming
 * back. Nothing in the body is trusted: the order id is in our own URL, the invoice is READ from Moyasar by the id we saved, and
 * only a paid one for that order and price adds the balance (once, however many times it is called).
 */
export async function POST(req: Request) {
  const id = new URL(req.url).searchParams.get("order") ?? "";
  const r = await settleMoyasarOrder(id).catch((e) => {
    console.error("moyasar webhook", id, e);
    return null;
  });
  return NextResponse.json({ ok: true, paid: !!r?.paid });
}
