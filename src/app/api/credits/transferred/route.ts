import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { markCreditTransferred } from "@/lib/credits/orders";
import { loadCreditSettings } from "@/lib/credits/settings";
import { supportLink } from "@config/credits";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** «اشحن رصيدك» · «تم التحويل»: the owner is told at once; the answer carries the WhatsApp link for «طال الوقت؟». Body: { orderId }. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  if (typeof b.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.orderId)) throw new UserError("طلب غير صحيح.", 400);
  const order = await markCreditTransferred({ id: user.id }, b.orderId);
  const s = await loadCreditSettings();
  return NextResponse.json({ order, support: supportLink(s, { id: order.id, packName: order.packName, price: order.price, email: order.email }) });
});
