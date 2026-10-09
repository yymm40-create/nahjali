import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { isProduct } from "@config/course";
import { startOrder } from "@/lib/course/orders";

export const dynamic = "force-dynamic";

/**
 * «دورة الجواد الذكي» · «ادفع الآن». Body: { product, name, phone }. The person must be signed in (their e-mail is recorded with
 * the order). Returns the order (its price is kept for a few hours) and the bank data to transfer to.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { product?: unknown; name?: unknown; phone?: unknown };
  if (!isProduct(b.product)) throw new UserError("اختر الدورة اللي تبيها.", 400);
  const r = await startOrder({ id: user.id, email: user.email }, { product: b.product, name: b.name, phone: b.phone });
  return NextResponse.json(r);
});
