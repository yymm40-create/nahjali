import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { getMemory, MEMORY_MAX, saveMemory } from "@/lib/memory/server";

export const dynamic = "force-dynamic";

/** «ذاكرتي» · what the platform remembers about me, and whether it is on. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const m = await getMemory(user.id);
  return NextResponse.json({ ...m, max: MEMORY_MAX });
});

/** `{ enabled? , notes? , clear? }`: turn it on or off, edit it, or clear it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { enabled?: unknown; notes?: unknown; clear?: unknown };
  const m = await getMemory(user.id);
  if (!m.ready) throw new UserError("«ذاكرتي» ما تجهّزت بعد: شغّل ملف SQL رقم 0054 في Supabase.", 503);
  if (b.clear === true) await saveMemory(user.id, { notes: "" });
  else {
    const notes = typeof b.notes === "string" ? b.notes : undefined;
    if (notes !== undefined && notes.length > MEMORY_MAX) throw new UserError(`الذاكرة أطول من ${MEMORY_MAX} حرف.`);
    await saveMemory(user.id, { ...(typeof b.enabled === "boolean" ? { enabled: b.enabled } : {}), ...(notes !== undefined ? { notes } : {}) });
  }
  return NextResponse.json({ ok: true, ...(await getMemory(user.id)) });
});
