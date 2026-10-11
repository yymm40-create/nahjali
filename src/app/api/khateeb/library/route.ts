import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { readyRefs } from "@/lib/khateeb/reference";

export const dynamic = "force-dynamic";

/** «الخطيب الذكي» · the library's references a preacher may choose from (the ones that are read), poetry and sources. */
export const GET = handle(async () => {
  await requireStudentApiUser();
  return NextResponse.json({ refs: await readyRefs() });
});
