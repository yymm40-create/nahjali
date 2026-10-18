import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { codePrice } from "@/lib/course/orders";

export const dynamic = "force-dynamic";

/** «عندك كود خصم؟» · Body: { courseId, code } → { price } when the code is one of that course's active codes. Public (the price is all it tells). */
export const POST = handle(async (req: Request) => {
  const b = (await req.json().catch(() => ({}))) as { courseId?: unknown; code?: unknown };
  const r = await codePrice(typeof b.courseId === "string" ? b.courseId : "", b.code);
  if (!r) throw new UserError("كود الخصم غير صحيح.", 400);
  return NextResponse.json({ code: r.code, price: r.price });
});
