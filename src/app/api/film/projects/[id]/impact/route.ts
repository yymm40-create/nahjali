import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { getOwnedProject, requireFilmApiUser } from "@/lib/film/access";
import { applyImpact, dropImpact, impactsOf } from "@/lib/film/impact";

export const maxDuration = 120;

/** «الرجوع الذكي»: the lists of what an edit reached (the one still waiting is shown). */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id);
  return NextResponse.json({ impacts: await impactsOf(project.id) }, { headers: { "Cache-Control": "no-store" } });
});

/** `{ action: "apply", id, sheets?: [ids], generations?: [ids] }` remakes the chosen items; `{ action: "drop", id }` leaves everything. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const project = await getOwnedProject((await params).id, user.id, "all");
  const b = (await req.json().catch(() => ({}))) as { action?: unknown; id?: unknown; sheets?: unknown; generations?: unknown };
  if (b.action === "apply") return NextResponse.json(await applyImpact(project, user, b.id, b));
  if (b.action === "drop") {
    await dropImpact(project, b.id);
    return NextResponse.json({ ok: true });
  }
  throw new UserError("إجراء غير معروف.", 400);
});
