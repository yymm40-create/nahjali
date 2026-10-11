import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { isAdmin } from "@config/site";
import { requireEditorApiUser, requireJawadOwner } from "@/lib/jawad/server/access";
import { makeSfx, sfxLibrary } from "@/lib/editor/sfx-library";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** «حيدرة كت» · «مكتبة المؤثرات»: the ready sound effects, with links to listen to the ones made. */
export const GET = handle(async () => {
  const { user } = await requireEditorApiUser();
  const lib = await sfxLibrary();
  return NextResponse.json({ ...lib, owner: isAdmin(user.email) }, { headers: { "Cache-Control": "no-store" } });
});

/** The owner makes the next missing effects (a few at a time; the page asks again until none are left), or redoes some. */
export const POST = handle(async (req: Request) => {
  await requireJawadOwner();
  const b = (await req.json().catch(() => ({}))) as { redo?: unknown };
  const redo = Array.isArray(b.redo) ? b.redo.filter((x): x is string => typeof x === "string").slice(0, 8) : undefined;
  return NextResponse.json(await makeSfx({ redo }));
});
