import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { startUnlimited, unlimitedStatus } from "@/lib/jawad/server/unlimited";

export const dynamic = "force-dynamic";

/** «لامحدود»: POST { pass, hours } → { url } of our checkout page for that pass (signed in). GET → the passes running for this person. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { pass?: unknown; hours?: unknown };
  return NextResponse.json(await startUnlimited(user, new URL(req.url).origin, b.pass, b.hours));
});

export const GET = handle(async () => {
  const user = await requireApiUser();
  return NextResponse.json({ passes: await unlimitedStatus(user.id) });
});
