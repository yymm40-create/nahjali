import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { markTransferred } from "@/lib/course/orders";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** «دورة الجواد الذكي» · «تم التحويل»: the owner is told at once. Body: { orderId }. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  if (typeof b.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.orderId)) throw new UserError("طلب غير صحيح.", 400);
  return NextResponse.json({ order: await markTransferred({ id: user.id }, b.orderId) });
});
