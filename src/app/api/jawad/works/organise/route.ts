import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { createFolder, deleteFolder, organiseState, renameFolder, setMark } from "@/lib/jawad/server/works-organise";

/** JAWAD AI · «ترتيب أعمالي»: whether folders and ⭐ are on (migration 0113), and the person's folders with their counts. */
export const GET = handle(async () => {
  const { user } = await requireJawadApiUser();
  return NextResponse.json(await organiseState(user.id));
});

/**
 * JAWAD AI · «ترتيب أعمالي»: `{ action: "folder_create", name }` · `{ action: "folder_rename", id, name }` ·
 * `{ action: "folder_delete", id }` (its works stay, out of any folder) · `{ action: "mark", type: "job" | "film", id,
 * folderId?: id | null, favourite?: boolean }` (only the person's own work, only into their own folder).
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  switch (b.action) {
    case "folder_create":
      return NextResponse.json({ folder: await createFolder(user.id, b.name) });
    case "folder_rename":
      await renameFolder(user.id, b.id, b.name);
      return NextResponse.json({ ok: true });
    case "folder_delete":
      await deleteFolder(user.id, b.id);
      return NextResponse.json({ ok: true });
    case "mark":
      return NextResponse.json({ mark: await setMark(user.id, b) });
    default:
      throw new UserError("طلب غير صحيح.", 400);
  }
});
