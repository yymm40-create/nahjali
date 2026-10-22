import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { startCreditOrder } from "@/lib/credits/orders";
import { contactComplete, contactOf } from "@/lib/contact";
import { adContext } from "@/lib/track-server";

export const dynamic = "force-dynamic";

/**
 * «اشحن رصيدك» · «ادفع الآن». Body: { pack, source? } (name and number from the account) — `source` is where the visitor came from (the jw_src cookie,
 * see src/lib/track.ts), kept on the order with Meta's _fbp/_fbc cookies and the buyer's address and browser. Returns the
 * order and the bank data to transfer to.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { pack?: unknown; source?: unknown };
  // the name and WhatsApp number come from the account («الحساب الشخصي»), never from the payment form
  const contact = contactOf(user);
  if (!contactComplete(contact)) throw new UserError("كمّل اسمك ورقم جوالك في حسابك الشخصي أولًا.", 409);
  const ad = adContext(req);
  return NextResponse.json(await startCreditOrder({ id: user.id, email: user.email }, { pack: b.pack, name: contact.name, phone: contact.phone, source: b.source ?? ad.source }, ad));
});
