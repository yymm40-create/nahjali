import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { listVoices } from "@/lib/jawad/server/voices";

/** «الطالب الذكي» · the voices a student can pick for the audio (open even while the rest of JAWAD AI is closed). */
export const GET = handle(async () => {
  const { user, owner } = await requireStudentApiUser();
  return NextResponse.json(await listVoices(user.id, owner));
});
