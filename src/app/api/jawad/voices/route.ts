import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { cloneVoice, deleteVoice, designVoice, listVoices, renameVoice, saveDesigned } from "@/lib/jawad/server/voices";

// Designing three previews or copying a voice takes a few seconds to a minute at ElevenLabs
export const maxDuration = 120;

/** JAWAD AI · the person's voice library and ElevenLabs' ready voices. */
export const GET = handle(async () => {
  const { user, owner } = await requireJawadApiUser();
  return NextResponse.json(await listVoices(user.id, owner));
});

/**
 * JAWAD AI · the voice library: `{ action: "design", key, description, text?, referenceId?, referenceUse? }` (three
 * previews, charged) · `{ action: "save", draftId, index, name }` · `{ action: "clone", key, uploadId, name, consent }`
 * (charged) · `{ action: "rename", id, name }` · `{ action: "delete", id }`.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "design":
      return NextResponse.json({ draft: await designVoice(user, owner, b) });
    case "save":
      return NextResponse.json({ voice: await saveDesigned(user, owner, b) });
    case "clone":
      return NextResponse.json({ voice: await cloneVoice(user, owner, b) });
    case "rename":
      await renameVoice(user.id, b.id, b.name);
      return NextResponse.json({ ok: true });
    case "delete":
      await deleteVoice(user.id, b.id);
      return NextResponse.json({ ok: true });
    default:
      throw new UserError("طلب غير صحيح.", 400);
  }
});
