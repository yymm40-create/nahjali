import { NextResponse } from "next/server";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { claimOrder } from "@/lib/orders";
import { DEV_PAYMENT_ENABLED } from "@config/pricing";

/** Development-only payment stand-in until Moyasar is connected. Disabled in production. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  if (!DEV_PAYMENT_ENABLED || process.env.NODE_ENV === "production") {
    throw new UserError("الدفع التجريبي غير متاح.", 403);
  }
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);
  if (order.status !== "pending_payment") throw new UserError(MESSAGES.wrongStep, 409);

  await claimOrder(order.id, ["pending_payment"], "paid");
  return NextResponse.json({ ok: true });
});
