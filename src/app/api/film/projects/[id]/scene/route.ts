import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { saveSuccessfulScene } from "@/lib/editor/film";

// copying a long montage can take a moment
export const maxDuration = 120;

/** «المشهد الناجح»: keeps the film's exported montage as its finished scene. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const { id } = await params;
  const project = await getOwnedProject(id, user.id, "montage");
  await saveSuccessfulScene(project);
  return NextResponse.json({ ok: true });
});
