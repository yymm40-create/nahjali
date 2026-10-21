import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { startCreditOrder } from "@/lib/credits/orders";
import { adContext } from "@/lib/track-server";

export const dynamic = "force-dynamic";

/**
 * «اشحن رصيدك» · «ادفع الآن». Body: { pack, name, phone, source? } — `source` is where the visitor came from (the jw_src cookie,
 * see src/lib/track.ts), kept on the order with Meta's _fbp/_fbc cookies and the buyer's address and browser. Returns the
 * order and the bank data to transfer to.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { pack?: unknown; name?: unknown; phone?: unknown; source?: unknown };
  const ad = adContext(req);
  return NextResponse.json(await startCreditOrder({ id: user.id, email: user.email }, { pack: b.pack, name: b.name, phone: b.phone, source: b.source ?? ad.source }, ad));
});
