import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { smartEdit, type EditBody } from "@/lib/jawad/server/smart-edit";
import { jobViews } from "@/lib/jawad/server/works";

// Claude writes the corrected prompt, then the generation starts (run after the response, see runJob)
export const maxDuration = 300;
/** Frames of the original video come with the request. */
const MAX_BODY = 4_200_000;

/**
 * JAWAD AI · «التعديل الذكي» of a finished video or image. `{ quote: true, … }` returns only the price; otherwise the
 * edit job is made (the price the user saw must match) and Claude writes its prompt before it is sent.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const text = await req.text();
  if (text.length > MAX_BODY) throw new UserError("الطلب كبير جدًا.", 413);
  let body: EditBody;
  try {
    body = JSON.parse(text || "{}") as EditBody;
  } catch {
    throw new UserError("طلب غير صحيح.", 400);
  }
  const r = await smartEdit(user, owner, body, new URL(req.url).origin);
  if (r.kind === "quote") return NextResponse.json({ coins: r.coins, lines: r.lines, cut: r.cut });
  if (r.kind === "issues") return NextResponse.json({ error: r.issues[0]?.message ?? "الطلب غير صالح.", issues: r.issues }, { status: 422 });
  if (r.kind === "price_changed") return NextResponse.json({ error: `تغيّر السعر إلى ${r.coins} نقدة. أكّد المبلغ الجديد.`, code: "price_changed", coins: r.coins, lines: r.lines }, { status: 409 });
  const [job] = await jobViews([r.job]);
  return NextResponse.json({ job, created: r.kind === "created", balance: r.balance });
});
