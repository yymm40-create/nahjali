import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@config/site";
import { isJudge, setEntry, setJudge, setPlace } from "@/lib/contest/server";

export const dynamic = "force-dynamic";

/**
 * «مسابقة الفيلم السينمائي»: `{ action }` — add / remove (a person's own video in or out of the contest), place (the
 * owner and the judges set 1st–3rd), judge_add / judge_remove (the owner only).
 */
export const POST = handle(async (req: Request) => {
  const { data } = await (await createClient()).auth.getUser();
  const user = data.user;
  if (!user) throw new UserError("سجّل دخولك أول.", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "add":
    case "remove":
      return NextResponse.json(await setEntry(user.id, b.assetId, b.action === "add"));
    case "place":
      if (!(await isJudge(user.email))) throw new UserError("هذي للتحكيم بس.", 403);
      return NextResponse.json(await setPlace(b.place, b.assetId));
    case "judge_add":
    case "judge_remove":
      if (!isAdmin(user.email)) throw new UserError("هذي لصاحب المنصة بس.", 403);
      return NextResponse.json(await setJudge(b.email, b.action === "judge_add"));
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
});
