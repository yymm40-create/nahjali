import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { importables } from "@/lib/editor/server";

/** «حيدرة كت» · the person's own works that can be brought into an edit (JAWAD AI results, film videos). */
export const GET = handle(async () => {
  const { user } = await requireStudentApiUser();
  return NextResponse.json({ items: await importables(user.id) }, { headers: { "Cache-Control": "no-store" } });
});
