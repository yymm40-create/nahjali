import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { castChoices, describeVoice, editLine, lineAudios, prepareLines, setCast, speakLine, voiceCast, voiceLines, voicesReady } from "@/lib/film/voices";
import { ownTracks } from "@/lib/film/voice-track";
import { withProjectClaude } from "@/lib/film/journey";

// («prepare» reads up to 40 lines in one Claude call)
export const maxDuration = 300;

/** The film's voices: its spoken lines, who speaks each speaker, the spoken files, and the voices to choose from. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  const [lines, cast, audios, voices, tracks] = await Promise.all([voiceLines(project.id), voiceCast(project.id), lineAudios(project.id), voicesReady() ? castChoices(user.id) : [], ownTracks(project.id)]);
  // tracks: «الحوار من جهازي», the person's own recording per shot
  return NextResponse.json({ ready: voicesReady(), lines, cast, audios, voices, tracks }, { headers: { "Cache-Control": "no-store" } });
});

/**
 * `{ action: "cast", speaker, voice }` · `{ action: "prepare", keys, idempotencyKey, diction }` («ولّد كل الجمل»: the
 * lines' pronunciation in one Claude call, charged; each line's prepared text comes back sealed) · `{ action: "speak",
 * key, idempotencyKey, prepared? }` (one line, charged) · `{ action: "describe", speaker, hint? }`.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id, "director");
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "cast") {
    await setCast(project, user.id, b.speaker, b.voice);
    return NextResponse.json({ ok: true });
  }
  // the project's journey, or the person's model (its real usage is what the line costs), not always the default
  const mind = <T,>(fn: () => Promise<T>) => withProjectClaude(project, user.email, b.model, fn);
  // «✨ صوت جديد بالوصف»: the AI writes the voice of one speaker (designed and saved with JAWAD AI's voices)
  if (b.action === "describe") return NextResponse.json(await mind(() => describeVoice(project, b.speaker, b.hint)));
  if (b.action === "prepare") return NextResponse.json(await mind(() => prepareLines(project, user, b.keys, b.idempotencyKey, b.diction)));
  if (b.action === "speak") return NextResponse.json(await mind(() => speakLine(project, user, b.key, b.idempotencyKey, b.emotion, b.diction, b.prepared)));
  // «عدّل النص»: a line's words or diacritics corrected before it is spoken
  if (b.action === "edit_line") return NextResponse.json(await editLine(project, b.key, b.text));
  throw new UserError("طلب غير صحيح.", 400);
});
