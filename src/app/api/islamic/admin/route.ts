import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { addSource, answers, counts, kvAll, kvSet, librarySize, noteAnswer, removeSource, resetSource, runRead, sources, updateSource } from "@/lib/islamic/library";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The dashboard's view: the sources with their counts, the settings, the latest answers. */
export const GET = handle(async () => {
  await owner();
  const [src, c, kv, ans, bytes] = await Promise.all([sources(), counts(), kvAll(), answers(), librarySize()]);
  return NextResponse.json({ sources: src, counts: c, kv, answers: ans, bytes });
});

/** One action of the dashboard (see /admin/islamic). */
export const POST = handle(async (req: Request) => {
  await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  switch (b.action) {
    case "read":
      // one run (a few minutes at most); the page calls again until `done`
      return NextResponse.json(await runRead(id));
    case "reset":
      await resetSource(id);
      return NextResponse.json({ ok: true });
    case "add":
      return NextResponse.json({ source: await addSource(String(b.name ?? ""), String(b.url ?? "")) });
    case "update":
      await updateSource(id, { ...(typeof b.enabled === "boolean" ? { enabled: b.enabled } : {}), ...(typeof b.notes === "string" ? { notes: b.notes.slice(0, 4000) } : {}), ...(typeof b.name === "string" && b.name.trim() ? { name: b.name.trim().slice(0, 200) } : {}) });
      return NextResponse.json({ ok: true });
    case "remove":
      await removeSource(id);
      return NextResponse.json({ ok: true });
    case "kv":
      await kvSet(String(b.key ?? ""), String(b.value ?? ""));
      return NextResponse.json({ ok: true });
    case "note":
      await noteAnswer(id, String(b.note ?? ""));
      return NextResponse.json({ ok: true });
  }
  throw new UserError("طلب غير معروف.");
});
