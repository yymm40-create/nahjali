import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireEditorApiUser } from "@/lib/jawad/server/access";
import { deleteTemplate, listTemplates, saveTemplate } from "@/lib/editor/templates-server";

const noStore = { headers: { "Cache-Control": "no-store" } };

/** «حيدرة كت» · «قوالب المونتاج»: the person's own templates (the ready ones are in the page). */
export const GET = handle(async () => {
  const { user } = await requireEditorApiUser();
  return NextResponse.json(await listTemplates(user.id), noStore);
});

/** «احفظ كقالب»: `{ template }` made from the project in the page; kept after the server checks it again. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireEditorApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ template: await saveTemplate(user.id, b.template) });
});

/** `?id=u:…` — one of the person's templates removed. */
export const DELETE = handle(async (req: Request) => {
  const { user } = await requireEditorApiUser();
  await deleteTemplate(user.id, new URL(req.url).searchParams.get("id"));
  return NextResponse.json({ ok: true });
});
