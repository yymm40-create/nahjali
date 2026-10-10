import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { confirmCreditOrder, listCreditOrders, rejectCreditOrder, type CreditStatus } from "@/lib/credits/orders";
import { loadCreditSettings, saveCreditSettings } from "@/lib/credits/settings";
import { telegramFull } from "@/lib/course/telegram";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

const STATUSES: CreditStatus[] = ["started", "transferred", "confirmed", "rejected"];

export const GET = handle(async (req: Request) => {
  await owner();
  const status = new URL(req.url).searchParams.get("status");
  const [settings, orders] = await Promise.all([loadCreditSettings(), listCreditOrders(STATUSES.includes(status as CreditStatus) ? (status as CreditStatus) : undefined)]);
  return NextResponse.json({ settings, orders, telegram: telegramFull() });
});

/** save { settings: { packs, featured, whatsapp } } · confirm { id } · reject { id, note? } */
export const POST = handle(async (req: Request) => {
  const user = await owner();
  const by = user.email ?? user.id;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "save": {
      const s = (b.settings && typeof b.settings === "object" ? b.settings : {}) as Record<string, unknown>;
      return NextResponse.json({ settings: await saveCreditSettings({ packs: s.packs, featured: s.featured, whatsapp: s.whatsapp }, by) });
    }
    case "confirm":
      if (typeof b.id !== "string") throw new UserError("طلب غير صحيح.", 400);
      return NextResponse.json(await confirmCreditOrder(b.id, by));
    case "reject":
      if (typeof b.id !== "string") throw new UserError("طلب غير صحيح.", 400);
      return NextResponse.json({ order: await rejectCreditOrder(b.id, by, typeof b.note === "string" ? b.note : "") });
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
});
