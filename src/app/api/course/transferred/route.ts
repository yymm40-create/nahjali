import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { markTransferred } from "@/lib/course/orders";
import { loadSettings } from "@/lib/course/settings";
import { groupLinkFor } from "@config/course";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** «دورة الجواد الذكي» · «تم التحويل»: the owner is told at once and the group's link is given. Body: { orderId }. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { orderId?: unknown };
  if (typeof b.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(b.orderId)) throw new UserError("طلب غير صحيح.", 400);
  const order = await markTransferred({ id: user.id }, b.orderId);
  // the group's link comes now (joining is approved by the owner in WhatsApp, after he has seen the money)
  // only the clock course has a group: every buyer of it gets the link (live, recorded or whole); nobody else does
  const s = await loadSettings();
  return NextResponse.json({ order, groupLink: groupLinkFor(s, order.courseId) });
});
