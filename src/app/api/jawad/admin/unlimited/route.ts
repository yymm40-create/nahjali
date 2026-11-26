import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadOwner } from "@/lib/jawad/server/access";
import { addPassMinutes } from "@/lib/jawad/server/unlimited";
import { coinBalance, grantCoins } from "@/lib/coins";

export const dynamic = "force-dynamic";

/**
 * The owner's «متابعة اللامحدود» actions:
 *   { action: "minutes", userId, paymentId, minutes }  add (or take back, negative) minutes on one purchase of a pass
 *   { action: "refund", userId, sar, note }            give riyals back to the person's wallet (a «grant» with the note)
 */
export const POST = handle(async (req: Request) => {
  await requireJawadOwner();
  const b = (await req.json().catch(() => ({}))) as { action?: string; userId?: string; paymentId?: string; minutes?: unknown; sar?: unknown; note?: unknown };
  const userId = String(b.userId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new UserError("الحساب غير صحيح.", 400);
  if (b.action === "minutes") {
    const total = await addPassMinutes(userId, String(b.paymentId ?? ""), Number(b.minutes));
    return NextResponse.json({ ok: true, bonusMin: total });
  }
  if (b.action === "refund") {
    const halalas = Math.round(Number(b.sar) * 100);
    if (!Number.isFinite(halalas) || halalas <= 0 || halalas > 100_000) throw new UserError("اكتب مبلغ بالريال (أكثر من صفر، لين ١٠٠٠).", 400);
    const note = String(b.note ?? "").trim().slice(0, 120) || "تعويض من الجواد الذكي";
    await grantCoins(userId, halalas, note);
    return NextResponse.json({ ok: true, balance: await coinBalance(userId) });
  }
  throw new UserError("طلب غير معروف.", 400);
});
