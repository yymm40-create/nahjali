import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { openFilmEdit } from "@/lib/editor/film";

export const maxDuration = 60;

/** The film maker's «المونتاج» step: opens (or makes) this film's edit with its chosen videos → `{ id }`. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const film = await getOwnedProject((await params).id, user.id);
  return NextResponse.json({ id: await openFilmEdit(film, user) });
});
