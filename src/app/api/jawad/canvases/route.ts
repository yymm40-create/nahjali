import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { createCanvas, listCanvases } from "@/lib/jawad/server/canvas";

/** JAWAD AI · «اللوحة»: whether saving is on (migration 0126), and the person's canvases and recipes. */
export const GET = handle(async () => {
  const { user } = await requireJawadApiUser();
  return NextResponse.json(await listCanvases(user.id));
});

/** JAWAD AI · «اللوحة»: a new canvas `{ name, graph }`, a recipe `{ kind: "recipe", name, graph }`, or a copy `{ fromId, name? , kind? }`. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ canvas: await createCanvas(user.id, b) });
});
