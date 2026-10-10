import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireBookletUser } from "@/lib/tables-booklet/access";
import { bookletPrice, deleteChat, getChat, listChats, myBooklets } from "@/lib/tables-booklet/server";
import { posesOf, READY_POSES } from "@config/tables-booklet";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** My conversations with «نور» and my booklets; or one conversation (`?id=`) with its booklet's price; or the ready booklet's price (`?ready=1`). */
export const GET = handle(async (req: Request) => {
  const user = await requireBookletUser();
  const q = new URL(req.url).searchParams;
  if (q.get("ready")) return NextResponse.json({ price: await bookletPrice(user.email, READY_POSES) });
  const id = q.get("id");
  if (!id) {
    const [chats, booklets] = await Promise.all([listChats(user.id).catch(() => []), myBooklets(user.id)]);
    return NextResponse.json({ chats, booklets });
  }
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  return NextResponse.json({ chat, price: chat.spec ? await bookletPrice(user.email, posesOf(chat.spec).length) : null });
});

export const DELETE = handle(async (req: Request) => {
  const user = await requireBookletUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteChat(user.id, id);
  return NextResponse.json({ ok: true });
});
