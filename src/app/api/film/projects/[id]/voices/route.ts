import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { castChoices, describeVoice, lineAudios, setCast, speakLine, voiceCast, voiceLines, voicesReady } from "@/lib/film/voices";

export const maxDuration = 120;

/** The film's voices: its spoken lines, who speaks each speaker, the spoken files, and the voices to choose from. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  const [lines, cast, audios, voices] = await Promise.all([voiceLines(project.id), voiceCast(project.id), lineAudios(project.id), voicesReady() ? castChoices(user.id) : []]);
  return NextResponse.json({ ready: voicesReady(), lines, cast, audios, voices }, { headers: { "Cache-Control": "no-store" } });
});

/** `{ action: "cast", speaker, voice }` · `{ action: "speak", key, idempotencyKey }` (one line, charged) · `{ action: "describe", speaker, hint? }`. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id, "director");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "cast") {
    await setCast(project, user.id, b.speaker, b.voice);
    return NextResponse.json({ ok: true });
  }
  // «✨ صوت جديد بالوصف»: the AI writes the voice of one speaker (designed and saved with JAWAD AI's voices)
  if (b.action === "describe") return NextResponse.json(await describeVoice(project, b.speaker, b.hint));
  if (b.action === "speak") return NextResponse.json(await speakLine(project, user, b.key, b.idempotencyKey, b.emotion));
  throw new UserError("طلب غير صحيح.", 400);
});
