import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { ProviderError } from "@/lib/jawad/server/providers/common";
import { elevenTranscribe } from "@/lib/jawad/server/providers/elevenlabs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A spoken message is short: up to two minutes, sent with the request (no upload, nothing stored). */
const MAX_BYTES = 3_000_000;
const TYPES: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav" };

/**
 * The microphone of every robot's chat: `{ audio: base64, mime }` → `{ text }` (ElevenLabs Scribe). A signed-in person only;
 * the platform carries this small cost, so a message takes nothing from the balance.
 */
export const POST = handle(async (req: Request) => {
  await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { audio?: unknown; mime?: unknown };
  const mime = String(b.mime ?? "").split(";")[0];
  const ext = TYPES[mime];
  if (!ext || typeof b.audio !== "string") throw new UserError("صيغة التسجيل غير مقبولة.", 400);
  const buf = Buffer.from(b.audio, "base64");
  if (!buf.length) throw new UserError("ما وصل صوت.", 400);
  if (buf.length > MAX_BYTES) throw new UserError("التسجيل طويل؛ خلّه أقل من دقيقتين.", 400);
  const heard = await elevenTranscribe({ file: new Blob([new Uint8Array(buf)], { type: mime }), name: `voice.${ext}` }).catch((err) => {
    if (err instanceof ProviderError) {
      console.error("voice", err.detail);
      throw new UserError(err.userMessage, 502);
    }
    throw err;
  });
  const text = heard.words.map((w) => w.text).join(" ").replace(/\s+([،,.؟?!:])/g, "$1").trim();
  if (!text) throw new UserError("سجّلت بس ما فهمت كلام في التسجيل. تأكد إن المايك الصحيح مختار وقرّب منه، وجرّب مرة ثانية.", 422);
  return NextResponse.json({ text });
});
