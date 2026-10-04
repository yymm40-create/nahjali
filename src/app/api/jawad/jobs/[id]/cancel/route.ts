import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { coinBalance } from "@/lib/coins";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { cancelJob } from "@/lib/jawad/server/jobs";
import { isUuid } from "@/lib/jawad/server/uploads";

/** JAWAD AI · cancels a video still waiting in the provider's queue (its coins are given back). */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  const { id } = await params;
  if (!isUuid(id)) throw new UserError("طلب غير صحيح.", 400);
  await cancelJob(user.id, id);
  return NextResponse.json({ ok: true, balance: await coinBalance(user.id) });
});
