import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireGamesUser } from "@/lib/games/access";
import { deleteChat, getChat, listChats } from "@/lib/games/chats";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «صانع الألعاب الذكي» · my conversations: the list, or one (`?id=`). */
export const GET = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ chats: await listChats(user.id) });
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  return NextResponse.json({ chat });
});

export const DELETE = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteChat(user.id, id);
  return NextResponse.json({ ok: true });
});
