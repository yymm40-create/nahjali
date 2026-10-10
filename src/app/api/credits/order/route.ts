import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { startCreditOrder } from "@/lib/credits/orders";

export const dynamic = "force-dynamic";

/** «اشحن رصيدك» · «ادفع الآن». Body: { pack, name, phone }. Returns the order and the bank data to transfer to. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { pack?: unknown; name?: unknown; phone?: unknown };
  return NextResponse.json(await startCreditOrder({ id: user.id, email: user.email }, { pack: b.pack, name: b.name, phone: b.phone }));
});
