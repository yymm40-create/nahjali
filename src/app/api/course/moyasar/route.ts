import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { startCardOrder } from "@/lib/course/orders";
import { jawadSession } from "@/lib/jawad/server/access";
import { CARD_PAYMENT_PUBLIC } from "@config/pricing";

export const dynamic = "force-dynamic";

/**
 * «دورة الجواد الذكي» · «ادفع بالبطاقة» through Moyasar. Body: { courseId, name, phone, code?, product? } → { order, url }: the buyer is
 * sent to `url` (Moyasar's invoice page). The person must be signed in (their e-mail is recorded with the order).
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { owner } = await jawadSession();
  if (!CARD_PAYMENT_PUBLIC && !owner) throw new UserError("الدفع بالبطاقة يتفعّل قريبًا إن شاء الله.", 403);
  const b = (await req.json().catch(() => ({}))) as { courseId?: unknown; name?: unknown; phone?: unknown; code?: unknown; product?: unknown };
  const r = await startCardOrder({ id: user.id, email: user.email }, { courseId: b.courseId, name: b.name, phone: b.phone, code: b.code, product: b.product }, new URL(req.url).origin, owner);
  return NextResponse.json(r);
});
