import { fmtSar } from "@config/coins";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { createJob, type GenerateBody } from "@/lib/jawad/server/jobs";
import { jobViews } from "@/lib/jawad/server/works";

// The image and speech providers answer within the same request (run after the response, see runJob)
export const maxDuration = 300;

/**
 * JAWAD AI · start a generation. Everything is checked again here (generator, stored files, settings, current
 * prices); the price the user saw must match, otherwise the new price is returned for confirmation (409).
 * The click's idempotency key makes a repeat return the same job without a second charge.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = (await req.json().catch(() => ({}))) as GenerateBody;
  const r = await createJob(user, owner, body, new URL(req.url).origin);
  if (r.kind === "issues") return NextResponse.json({ error: r.issues[0]?.message ?? "الطلب غير صالح.", issues: r.issues }, { status: 422 });
  if (r.kind === "price_changed") {
    return NextResponse.json({ error: `تغيّر السعر إلى ${fmtSar(r.coins)} ر.س. أكّد المبلغ الجديد.`, code: "price_changed", coins: r.coins, lines: r.lines, prices: r.prices }, { status: 409 });
  }
  const [job] = await jobViews([r.job]);
  return NextResponse.json({ job, created: r.kind === "created", balance: r.balance });
});
