import { NextResponse } from "next/server";
import { handle, requireApiUser } from "@/lib/api";
import { claim, myClaim, shareSettings } from "@/lib/share/server";

export const dynamic = "force-dynamic";

/** «انشرنا واربح» · the offer and where this person stands (a signed-out visitor gets the offer only). */
export const GET = handle(async () => {
  const s = await shareSettings();
  const user = await requireApiUser().catch(() => null);
  const c = user && s.ready ? await myClaim(user.id) : null;
  return NextResponse.json({ enabled: s.ready && s.enabled, rewardSar: s.rewardSar, signedIn: !!user, claim: c ? { status: c.status, handle: c.handle, rewardSar: c.rewardHalalas / 100 } : null });
});

/** «نشرت ✅» with their Instagram name: a claim waiting for the owner. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { handle?: unknown };
  const r = await claim(user, b.handle);
  return NextResponse.json({ claim: { status: r.claim.status, handle: r.claim.handle, rewardSar: r.claim.rewardHalalas / 100 }, told: r.told });
});
