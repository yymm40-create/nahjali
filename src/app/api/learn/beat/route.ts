import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { beat, endSession } from "@/lib/learn/server";

export const dynamic = "force-dynamic";

/** The player's «أنا موجود» (every ~20 s), its report of a tampered name tag, or the end of a viewing. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { session?: unknown; bad?: unknown; end?: unknown };
  if (typeof b.session !== "string" || !/^[0-9a-f-]{36}$/.test(b.session)) throw new UserError("طلب غير صحيح.", 400);
  if (b.end) {
    await endSession(user, b.session);
    return NextResponse.json({ ok: false });
  }
  const ok = await beat(user, b.session, typeof b.bad === "string" && b.bad ? b.bad.slice(0, 200) : undefined);
  return NextResponse.json({ ok }, { headers: { "cache-control": "no-store" } });
});
