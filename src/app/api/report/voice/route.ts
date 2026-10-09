import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { elevenTranscribe } from "@/lib/jawad/server/providers/elevenlabs";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The owner's problem button: a short voice note written out (ElevenLabs Scribe). Body: multipart `file`. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size < 500) throw new UserError("ما وصل تسجيل.", 400);
  if (file.size > 12 * 1024 * 1024) throw new UserError("التسجيل طويل؛ اختصره.", 413);
  const r = await elevenTranscribe({ file, name: "report.webm" });
  const text = r.words.map((w) => w.text).join(" ").trim();
  if (!text) throw new UserError("ما سمعت كلام في التسجيل.", 422);
  return NextResponse.json({ text });
});
