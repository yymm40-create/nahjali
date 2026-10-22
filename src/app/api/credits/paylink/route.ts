import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { startPaylinkOrder } from "@/lib/credits/orders";
import { adContext } from "@/lib/track-server";

export const dynamic = "force-dynamic";

/** «ادفع بالبطاقة». Body: { pack, name, phone, source? } → { order, url }: the buyer is sent to `url` (Paylink's payment page). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { pack?: unknown; name?: unknown; phone?: unknown; source?: unknown };
  const ad = adContext(req);
  const origin = new URL(req.url).origin;
  return NextResponse.json(await startPaylinkOrder({ id: user.id, email: user.email }, { pack: b.pack, name: b.name, phone: b.phone, source: b.source ?? ad.source }, ad, origin));
});
