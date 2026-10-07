import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { requireEditorApiUser } from "@/lib/jawad/server/access";
import { openSmartEdit } from "@/lib/editor/smart";

export const maxDuration = 60;

/** «التعديل الذكي» of a finished video, in «حيدرة كت»: `{ jobId, outputId? }` → `{ id }` of a new edit. */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireEditorApiUser();
  const section = (await loadRuntime()).sections.find((s) => s.implementation === "editor");
  // 409: the page then opens the usual «التعديل الذكي» window instead
  if (!section || (!section.enabled && !owner)) throw new UserError("حيدرة كت غير متاح حاليًا.", 409);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({ id: await openSmartEdit(user, b) });
});
