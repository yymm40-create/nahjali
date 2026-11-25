import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { deleteCanvas, getCanvas, updateCanvas } from "@/lib/jawad/server/canvas";

/** JAWAD AI · «اللوحة»: one of the person's canvases or recipes, with its graph. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  return NextResponse.json({ canvas: await getCanvas(user.id, (await params).id) });
});

/** JAWAD AI · «اللوحة»: saves `{ name?, graph? }` (the graph is checked before it is kept). */
export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ canvas: await updateCanvas(user.id, (await params).id, b) });
});

/** JAWAD AI · «اللوحة»: deletes a canvas or recipe (its generations stay in «أعمالي»). */
export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  await deleteCanvas(user.id, (await params).id);
  return NextResponse.json({ ok: true });
});
