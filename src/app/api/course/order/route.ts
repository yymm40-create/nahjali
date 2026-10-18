import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { startOrder } from "@/lib/course/orders";

export const dynamic = "force-dynamic";

/**
 * «دورة الجواد الذكي» · «ادفع الآن». Body: { courseId, name, phone }. The person must be signed in (their e-mail is recorded with
 * the order). Returns the order (its price is kept for a few hours) and the bank data to transfer to.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { courseId?: unknown; name?: unknown; phone?: unknown };
  const r = await startOrder({ id: user.id, email: user.email }, { courseId: b.courseId, name: b.name, phone: b.phone });
  return NextResponse.json(r);
});
