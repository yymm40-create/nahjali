import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { confirmUpload, uploadViews } from "@/lib/jawad/server/uploads";

export const maxDuration = 60;

/** JAWAD AI · step 2: the server reads the stored file and checks what it really is before it can be used. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const { id } = (await req.json().catch(() => ({}))) as { id?: unknown };
  const row = await confirmUpload(user.id, id);
  return NextResponse.json({ upload: (await uploadViews([row]))[0] });
});
