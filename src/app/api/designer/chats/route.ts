import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { deleteChat, getChat, listChats, saveLayers } from "@/lib/designer/chats";
import { fileLinks, uploadLinks } from "@/lib/designer/files";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** «المصمم الذكي» · my conversations: the list, or one (`?id=`) with fresh links to its pictures and designs. */
export const GET = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ chats: await listChats(user.id) });
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  const chat = await getChat(user.id, id);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const [ups, links, downloads] = await Promise.all([
    uploadLinks(user.id, chat.messages.flatMap((m) => (m.files ?? []).filter((f) => f.kind === "image").map((f) => f.id))),
    fileLinks(user.id, id),
    fileLinks(user.id, id, true),
  ]);
  const messages = chat.messages.map((m) => ({
    ...m,
    files: m.files?.map((f) => ({ ...f, url: ups.get(f.id) ?? null })),
    design: m.design
      ? {
          ...m.design,
          artworkUrl: m.design.artwork ? links.get(m.design.artwork) ?? null : null,
          finalUrl: m.design.final ? downloads.get(m.design.final) ?? null : null,
          layers: m.design.layers.map((l) => (l.kind === "image" ? { ...l, url: links.get(l.fileId) ?? null } : l)),
          ...(isAdmin(user.email) ? {} : { detail: undefined }),
        }
      : undefined,
  }));
  return NextResponse.json({ chat: { id: chat.id, title: chat.title, messages, pending: !!chat.pending, record: chat.record } });
});

/** The person's edits of the last design's layers (kept as they are). */
export const PUT = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; layers?: unknown };
  const id = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : "";
  if (!id) throw new UserError("محادثة غير صحيحة.", 400);
  try {
    const d = await saveLayers(user.id, id, b.layers);
    return NextResponse.json({ ok: true, layers: d.layers.length });
  } catch (e) {
    if (e instanceof Error && e.message === "chat not found") throw new UserError("ما لقينا هذي المحادثة.", 404);
    if (e instanceof Error && e.message === "no design") throw new UserError("ما فيه تصميم في هذي المحادثة.", 409);
    throw e;
  }
});

export const DELETE = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("محادثة غير صحيحة.", 400);
  await deleteChat(user.id, id);
  return NextResponse.json({ ok: true });
});
