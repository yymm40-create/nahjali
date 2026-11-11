import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { loadCreditSettings } from "@/lib/credits/settings";
import { activeCode } from "@config/credits";

export const dynamic = "force-dynamic";

/** «عندك كود خصم؟» on «اشحن رصيدك» · Body: { code } → { code, pct, until } when it works now. Public: the percent is all it tells. */
export const POST = handle(async (req: Request) => {
  const b = (await req.json().catch(() => ({}))) as { code?: unknown };
  const c = activeCode(await loadCreditSettings(), b.code);
  if (!c) throw new UserError("كود الخصم غير صحيح أو انتهى وقته.", 400);
  return NextResponse.json(c);
});
