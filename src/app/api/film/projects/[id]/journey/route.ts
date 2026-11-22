import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { projectJourney, setProjectJourney } from "@/lib/film/journey";
import { isFilmJourney } from "@config/film-journey";

/** «اختر رحلتك»: the project's journey (null when it never chose one). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  return NextResponse.json({ journey: await projectJourney(project.id) }, { headers: { "Cache-Control": "no-store" } });
});

/** `{ journey: "mixed" | "opus" | "haiku" }`: the mind of the replies written from now on (the project's owner chooses). */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  if (project.user_id !== user.id) throw new UserError("صاحب المشروع هو اللي يختار رحلته.", 403);
  const b = (await req.json().catch(() => ({}))) as { journey?: unknown };
  if (!isFilmJourney(b.journey)) throw new UserError("اختر رحلة من الثلاث.", 400);
  await setProjectJourney(project.id, b.journey);
  return NextResponse.json({ ok: true, journey: b.journey });
});
