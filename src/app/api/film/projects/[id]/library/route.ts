import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { filmLibrary } from "@/lib/film/library";

/** «المكتبة»: everything the scene made, with short-lived links. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  return NextResponse.json({ items: await filmLibrary(project) }, { headers: { "Cache-Control": "no-store" } });
});
