import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { addOwnItem, deleteItem, listLibrary, makeItem, renameItem } from "@/lib/jawad/server/library";
import { jobViews } from "@/lib/jawad/server/works";

// Making a picture is a generation like any other (it runs after the answer, see runJob)
export const maxDuration = 300;

/** JAWAD AI · «المكتبة»: whether it is open for the person, and their characters and places. */
export const GET = handle(async () => {
  const { user, owner } = await requireJawadApiUser();
  return NextResponse.json(await listLibrary(user.id, owner));
});

/**
 * JAWAD AI · «المكتبة»: `{ action: "add", kind, name, note?, uploadId | outputId }` (the person's own picture or one of
 * their results) · `{ action: "make", key, kind, name, note, expectedCoins }` (made from a description by GPT Image 2,
 * charged like any image; a different price is asked again, 409) · `{ action: "rename", id, name }` · `{ action: "delete", id }`.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "add":
      return NextResponse.json({ item: await addOwnItem(user, owner, b) });
    case "make": {
      const r = await makeItem(user, owner, b, new URL(req.url).origin);
      if (r.kind === "issues") return NextResponse.json({ error: r.issues[0]?.message ?? "الطلب غير صالح.", issues: r.issues }, { status: 422 });
      if (r.kind === "price_changed") return NextResponse.json({ error: `السعر ${r.coins} نقدة. أكّد المبلغ.`, code: "price_changed", coins: r.coins, lines: r.lines }, { status: 409 });
      const [job] = await jobViews([r.job]);
      return NextResponse.json({ job, created: r.kind === "created", balance: r.balance });
    }
    case "rename":
      await renameItem(user.id, b.id, b.name);
      return NextResponse.json({ ok: true });
    case "delete":
      await deleteItem(user.id, b.id);
      return NextResponse.json({ ok: true });
    default:
      throw new UserError("طلب غير صحيح.", 400);
  }
});
