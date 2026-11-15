import { NextResponse } from "next/server";
import { settleOffer10 } from "@/lib/jawad/server/offer10";
import { OFFER10 } from "@config/jawad/offer10";

export const dynamic = "force-dynamic";

// Moyasar comes here twice: the buyer after paying (GET, success_url) and its own notice (POST, callback_url). Nothing sent is
// trusted: the account id only picks whose saved invoices are READ from Moyasar, and only a paid one for 10 riyals starts the offer.

async function settle(req: Request) {
  const u = new URL(req.url).searchParams.get("u") ?? "";
  return settleOffer10(u).catch((e) => {
    console.error("offer10 settle", u, e);
    return false;
  });
}

export async function GET(req: Request) {
  const paid = await settle(req);
  const to = new URL(OFFER10.path, req.url);
  to.searchParams.set(paid ? "paid" : "unpaid", "1");
  return NextResponse.redirect(to, 303);
}

export async function POST(req: Request) {
  return NextResponse.json({ ok: true, paid: await settle(req) });
}
