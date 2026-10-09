import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { startSession } from "@/lib/learn/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Opens a viewing of one lesson: its own key, the list of pieces, and the name tag text. No file, no link. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { lessonId?: unknown };
  if (typeof b.lessonId !== "string" || !/^[0-9a-f-]{36}$/.test(b.lessonId)) throw new UserError("طلب غير صحيح.", 400);
  const start = await startSession(user, b.lessonId, clientIp(req.headers), req.headers.get("user-agent") ?? "");
  return NextResponse.json(start, { headers: { "cache-control": "no-store" } });
});
