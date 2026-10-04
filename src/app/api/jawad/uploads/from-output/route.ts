import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { uploadFromOutput, uploadViews } from "@/lib/jawad/server/uploads";

export const maxDuration = 60;

/** JAWAD AI · "use as reference": copies one of the user's results into a new, checked reference. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const { outputId } = (await req.json().catch(() => ({}))) as { outputId?: unknown };
  const row = await uploadFromOutput(user.id, outputId);
  return NextResponse.json({ upload: (await uploadViews([row]))[0] });
});
