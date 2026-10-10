import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireKharqUser } from "@/lib/kharq/access";
import { deleteChat, getChat, listChats } from "@/lib/kharq/chats";
import { outputLinks } from "@/lib/kharq/make";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «محمد الخارق» · my conversations: the list, or one (`?id=`). His internal template never leaves the server. */
export const GET = handle(async (req: Request) => {
  const { user } = await requireKharqUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ chats: await listChats(user.id) });
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  // the files جواد made in this conversation, by short-lived link, so the pictures and the videos show again
  const links = await outputLinks(user.id, chat.messages.flatMap((t) => (t.deliver?.media ?? []).map((m) => m.fileId ?? "")));
  const { id: cid, title, messages, stage, updatedAt } = chat;
  return NextResponse.json({ chat: { id: cid, title, messages, stage, updatedAt }, links: Object.fromEntries(links) });
});

export const DELETE = handle(async (req: Request) => {
  const { user } = await requireKharqUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteChat(user.id, id);
  return NextResponse.json({ ok: true });
});
