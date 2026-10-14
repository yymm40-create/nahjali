import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { deleteDirectorChat, getDirectorChat, listDirectorChats } from "@/lib/director/chats";
import { outputLinks } from "@/lib/kharq/make";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/i;

export const GET = handle(async (request: Request) => {
  const { user } = await requireJawadApiUser();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ chats: await listDirectorChats(user.id) });
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getDirectorChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const ids = chat.messages.flatMap((turn) => turn.media?.map((media) => media.fileId ?? "") ?? []);
  const links = await outputLinks(user.id, ids);
  return NextResponse.json({ chat, links: Object.fromEntries(links) });
});

export const DELETE = handle(async (request: Request) => {
  const { user } = await requireJawadApiUser();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteDirectorChat(user.id, id);
  return NextResponse.json({ ok: true });
});
