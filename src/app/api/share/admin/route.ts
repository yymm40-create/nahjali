import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { approveClaim, listClaims, rejectClaim, saveShareSettings, shareSettings } from "@/lib/share/server";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The owner's view: the switch, the reward, and the claims (pending first). */
export const GET = handle(async () => {
  await owner();
  const [settings, claims] = await Promise.all([shareSettings(), listClaims()]);
  return NextResponse.json({ settings, claims });
});

export const POST = handle(async (req: Request) => {
  const user = await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  switch (b.action) {
    case "settings":
      await saveShareSettings({ ...(typeof b.enabled === "boolean" ? { enabled: b.enabled } : {}), ...(b.rewardSar !== undefined ? { rewardSar: Number(b.rewardSar) } : {}) });
      return NextResponse.json({ ok: true });
    case "approve":
      return NextResponse.json(await approveClaim(id, user.email ?? "لوحة التحكم"));
    case "reject":
      return NextResponse.json({ claim: await rejectClaim(id, user.email ?? "لوحة التحكم") });
  }
  throw new UserError("إجراء غير معروف.");
});
