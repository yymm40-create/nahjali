import { NextResponse } from "next/server";
import { settlePaylinkOrder } from "@/lib/credits/orders";

export const dynamic = "force-dynamic";

/**
 * Where Paylink sends the buyer after paying (and may call itself). Nothing in the URL is trusted except the order id: the invoice
 * is read from Paylink, and only a paid one for that order and price adds the balance (once). Then back to the shop.
 */
async function settle(req: Request) {
  const id = new URL(req.url).searchParams.get("order") ?? "";
  const r = await settlePaylinkOrder(id).catch((e) => {
    console.error("paylink return", id, e);
    return null;
  });
  return { id, r };
}

export async function GET(req: Request) {
  const { id, r } = await settle(req);
  const to = new URL("/jawad-ai/credits", req.url);
  to.searchParams.set(r?.paid ? "paid" : "unpaid", r ? id : "1");
  return NextResponse.redirect(to, 303);
}

export async function POST(req: Request) {
  const { r } = await settle(req);
  return NextResponse.json({ ok: !!r?.paid });
}
