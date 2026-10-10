import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { deleteChat, getChat, listChats, memoryOff } from "@/lib/islamic/chats";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «الذكاء الإسلامي» · the remembered conversations: the list, or one (`?id=`). */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("هذا القسم في تجربة خاصة الحين.", 403);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    const chats = await listChats(user.id);
    return NextResponse.json({ chats, memory: !memoryOff });
  }
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  return NextResponse.json({ chat });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 403);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteChat(user.id, id);
  return NextResponse.json({ ok: true });
});
