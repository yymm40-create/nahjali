import { NextResponse } from "next/server";
import { settleMoyasarOrder } from "@/lib/credits/orders";

export const dynamic = "force-dynamic";

/**
 * Where Moyasar sends the buyer after paying (the invoice's success_url). Nothing in the URL is trusted except the order id: the
 * invoice is read from Moyasar, and only a paid one for that order and price adds the balance (once). Then back to the shop.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("order") ?? "";
  const r = await settleMoyasarOrder(id).catch((e) => {
    console.error("moyasar return", id, e);
    return null;
  });
  const to = new URL("/jawad-ai/credits", req.url);
  to.searchParams.set(r?.paid ? "paid" : "unpaid", r ? id : "1");
  return NextResponse.redirect(to, 303);
}
