import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, requireUser, UserError } from "@/lib/mahdi/server/api";
import { addMember, familyView, removeMember, setPin, switchTo } from "@/lib/mahdi/server/family";

/** My family (the parent and the members), whichever account of it I am in. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  return NextResponse.json({ family: await familyView(user.id) });
});

/**
 * `{ action: "pin", pin }` sets the parent's PIN · `{ action: "add", name }` adds a member ·
 * `{ action: "remove", id }` deletes a member's account · `{ action: "switch", id, pin? }` moves this browser into
 * another account of the family (a PIN unless the parent goes into a member's account).
 */
export const POST = mahdiRoute(async (req: Request) => {
  const body = await readJson(req);
  if (body.action === "switch") {
    const { user } = await requireUser(req);
    await switchTo(user.id, requireId(body.id), body.pin);
    return NextResponse.json({ ok: true });
  }
  const { user } = await requireProfile(req);
  if (body.action === "pin") await setPin(user.id, body.pin);
  else if (body.action === "add") await addMember(user.id, body.name);
  else if (body.action === "remove") await removeMember(user.id, requireId(body.id));
  else throw new UserError(t.errors.invalid, 400);
  return NextResponse.json({ family: await familyView(user.id) });
});
