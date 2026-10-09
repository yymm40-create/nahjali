import { fmtSar } from "@config/coins";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { improvePrompt, type DirectorBody } from "@/lib/jawad/server/director";

// Claude writes the prompt (once more if the answer breaks a rule)
export const maxDuration = 300;

/**
 * JAWAD AI · «المخرج الخارق»: the user's video prompt rewritten with the approved Super Director skill, for a fixed
 * price shown on the button (409 with the new price if it changed). Failures give the coins back.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = (await req.json().catch(() => ({}))) as DirectorBody;
  const r = await improvePrompt(user, owner, body);
  if (r.kind === "price_changed") {
    return NextResponse.json({ error: `تغيّر سعر التطوير إلى ${fmtSar(r.coins)} ر.س. أكّد المبلغ الجديد.`, code: "price_changed", coins: r.coins }, { status: 409 });
  }
  return NextResponse.json({ prompt: r.prompt, coins: r.coins, balance: r.balance });
});
