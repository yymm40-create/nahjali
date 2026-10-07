import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { forkProject, resetProject, rewindSummary } from "@/lib/film/rewind";

export const maxDuration = 120;

/** What would be kept and deleted if the project went back (for the confirmation). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  return NextResponse.json(await rewindSummary(project), { headers: { "Cache-Control": "no-store" } });
});

/** `{ to: "screenwriter" | "sheets" | "director", mode: "fork" | "reset" }`: a new project up to that point, or this one rewound. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id, "all");
  const b = (await req.json().catch(() => ({}))) as { to?: unknown; mode?: unknown };
  if (b.mode === "fork") return NextResponse.json(await forkProject(project, b.to));
  if (b.mode === "reset") return NextResponse.json(await resetProject(project, b.to));
  throw new UserError("اختر: مشروع جديد، أو التعديل على نفس المشروع.", 400);
});
