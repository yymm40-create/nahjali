import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { deleteChat, getChat, listChats } from "@/lib/content/chats";
import { producedLinks, uploadLinks } from "@/lib/content/files";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «صانع المحتوى» · my conversations: the list, or one (`?id=`) with fresh links to its pictures and slides. */
export const GET = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ chats: await listChats(user.id) });
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const [ups, links, downloads] = await Promise.all([
    uploadLinks(user.id, chat.messages.flatMap((m) => (m.files ?? []).filter((f) => f.kind === "image").map((f) => f.id))),
    producedLinks(user.id, id),
    producedLinks(user.id, id, true),
  ]);
  const messages = chat.messages.map((m) => ({
    ...m,
    files: m.files?.map((f) => ({ ...f, url: ups.get(f.id) ?? null })),
    slides: m.slides
      ? { ...m.slides, items: m.slides.items.map((s) => ({ ...s, url: links.get(s.fileId) ?? null, download: downloads.get(s.fileId) ?? null })), failed: m.slides.failed.map(({ n, reason, detail, text }) => ({ n, reason, text, ...(isAdmin(user.email) ? { detail } : {}) })) }
      : undefined,
  }));
  return NextResponse.json({ chat: { id: chat.id, title: chat.title, messages, pending: chat.pending ? { total: chat.pending.slides.length, mode: chat.pending.mode, todo: chat.pending.slides.map((x) => x.n) } : null, record: chat.record } });
});

export const DELETE = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteChat(user.id, id);
  return NextResponse.json({ ok: true });
});
