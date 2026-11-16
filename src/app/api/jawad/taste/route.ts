import { coinStr } from "@config/coins";
import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { withFixedPriceClaude } from "@/lib/film/claude-model";
import { deleteTaste, listLook, makeTaste, renameTaste, saveBrand, type MakeTasteBody } from "@/lib/jawad/server/taste";

// Claude looks at up to 20 pictures once
export const maxDuration = 300;

/** JAWAD AI · «ذوقي» and «هويتي»: the person's tastes and brand kit (`migrated: false` before 0116 runs). */
export const GET = handle(async () => {
  const { user } = await requireJawadApiUser();
  return NextResponse.json(await listLook(user.id));
});

/**
 * JAWAD AI · `{ action: "make", key, name, uploadIds, expectedCoins, model }` (a taste from 3–20 of the person's own
 * pictures, for the fixed price shown first; 409 with the new price if it changed; a failure gives it back) ·
 * `{ action: "rename", id, name }` · `{ action: "delete", id }` · `{ action: "brand", colors, fonts, voice, logoUploadId }`.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "make": {
      const r = await withFixedPriceClaude(b.model, () => makeTaste(user, owner, b as MakeTasteBody));
      if (r.kind === "price_changed") return NextResponse.json({ error: `تغيّر سعر التحليل إلى ${coinStr(r.coins)}. أكّد المبلغ الجديد.`, code: "price_changed", coins: r.coins }, { status: 409 });
      return NextResponse.json({ taste: r.taste, coins: r.coins, balance: r.balance });
    }
    case "rename":
      await renameTaste(user.id, b.id, b.name);
      return NextResponse.json({ ok: true });
    case "delete":
      await deleteTaste(user.id, b.id);
      return NextResponse.json({ ok: true });
    case "brand":
      return NextResponse.json({ brand: await saveBrand(user.id, b) });
    default:
      throw new UserError("طلب غير صحيح.", 400);
  }
});
