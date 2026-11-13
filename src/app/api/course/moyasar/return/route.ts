import { NextResponse } from "next/server";
import { settleCardOrder } from "@/lib/course/orders";
import { COURSE } from "@config/course";

export const dynamic = "force-dynamic";

/**
 * Where Moyasar sends the buyer after paying (the invoice's success_url). Nothing in the URL is trusted except the order id: the
 * invoices are read from Moyasar, and only a paid one for that order and price unlocks it (once). Then back to the course's page.
 */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("order") ?? "";
  const r = await settleCardOrder(id).catch((e) => {
    console.error("moyasar course return", id, e);
    return null;
  });
  const to = new URL(r?.order.courseId ? `${COURSE.base}/${r.order.courseId}` : COURSE.base, req.url);
  to.searchParams.set(r?.paid ? "paid" : "unpaid", "1");
  return NextResponse.redirect(to, 303);
}
