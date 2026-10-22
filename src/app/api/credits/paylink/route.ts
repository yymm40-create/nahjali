import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { startPaylinkOrder } from "@/lib/credits/orders";
import { contactComplete, contactOf } from "@/lib/contact";
import { adContext } from "@/lib/track-server";
import { jawadSession } from "@/lib/jawad/server/access";
import { CARD_PAYMENT_PUBLIC } from "@config/pricing";

export const dynamic = "force-dynamic";

/** «ادفع بالبطاقة». Body: { pack, source? } (name and number from the account) → { order, url }: the buyer is sent to `url` (Paylink's payment page). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  // not open to everyone yet: only the owners test it
  if (!CARD_PAYMENT_PUBLIC && !(await jawadSession()).owner) throw new UserError("الدفع بالبطاقة يتفعّل قريبًا إن شاء الله؛ استخدم التحويل البنكي.", 403);
  const b = (await req.json().catch(() => ({}))) as { pack?: unknown; source?: unknown };
  // the name and WhatsApp number come from the account («الحساب الشخصي»), never from the payment form
  const contact = contactOf(user);
  if (!contactComplete(contact)) throw new UserError("كمّل اسمك ورقم جوالك في حسابك الشخصي أولًا.", 409);
  const ad = adContext(req);
  const origin = new URL(req.url).origin;
  return NextResponse.json(await startPaylinkOrder({ id: user.id, email: user.email }, { pack: b.pack, name: contact.name, phone: contact.phone, source: b.source ?? ad.source }, ad, origin));
});
