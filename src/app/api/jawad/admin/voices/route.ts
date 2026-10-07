import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { requireJawadOwner } from "@/lib/jawad/server/access";
import { elevenDeleteVoice, elevenOwnVoices, elevenSlots } from "@/lib/jawad/server/providers/elevenlabs";
import { ProviderError } from "@/lib/jawad/server/providers/common";

const trouble = (e: unknown) => {
  throw new UserError(e instanceof ProviderError ? e.userMessage : "ما قدرنا نقرأ حساب ElevenLabs الحين.", 502);
};

/** The ElevenLabs account's voice slots and its own voices, each with whose library it is in (or nobody's). */
export const GET = handle(async () => {
  await requireJawadOwner();
  const [slots, voices] = await Promise.all([elevenSlots().catch(trouble), elevenOwnVoices().catch(trouble)]);
  const { data: rows } = await createAdminClient().from("jawad_voices").select("provider_voice_id,user_id,name");
  const users = new Map((await listAllUsers()).map((u) => [u.id, u.email ?? u.id]));
  const owner = new Map(((rows ?? []) as { provider_voice_id: string; user_id: string; name: string }[]).map((r) => [r.provider_voice_id, { email: users.get(r.user_id) ?? r.user_id, name: r.name }]));
  return NextResponse.json(
    { slots, voices: voices.map((v) => ({ ...v, usedBy: owner.get(v.voiceId) ?? null })) },
    { headers: { "Cache-Control": "no-store" } },
  );
});

/** `{ voiceId }`: frees its slot (deleted at ElevenLabs, and from the library that had it). */
export const POST = handle(async (req: Request) => {
  await requireJawadOwner();
  const b = (await req.json().catch(() => ({}))) as { voiceId?: unknown };
  const id = String(b.voiceId ?? "");
  if (!/^[A-Za-z0-9]{8,64}$/.test(id)) throw new UserError("طلب غير صحيح.", 400);
  await elevenDeleteVoice(id).catch(trouble);
  await createAdminClient().from("jawad_voices").delete().eq("provider_voice_id", id);
  return NextResponse.json({ ok: true });
});
