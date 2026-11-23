import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireContentUser } from "@/lib/content/access";
import { getChat } from "@/lib/content/chats";
import { attachmentsOf, producedLinks, uploadLinks } from "@/lib/content/files";
import { designAt, getStore, lookLines, picturesAt, readStore, saveStore } from "@/lib/content/project";
import { lastSlidesAt } from "@/lib/content/produce";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

async function ownChat(userId: string, id: unknown) {
  if (typeof id !== "string" || !UUID.test(id)) throw new UserError("مشروع غير صحيح.", 400);
  const chat = await getChat(userId, id);
  if (!chat) throw new UserError("ما لقينا هذا المشروع.", 404);
  return chat;
}

/**
 * «صانع المحتوى» · «خزان المراجع والثوابت» of a project: what the person fixed, removed and recommended, the references
 * they liked (their pictures), and what the site fixed by itself (the look, the approved pictures).
 */
export const GET = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const chat = await ownChat(user.id, new URL(req.url).searchParams.get("chatId"));
  const store = await getStore(chat.id);
  const at = lastSlidesAt(chat);
  const look = at >= 0 ? lookLines(chat.messages[at].slides!) : [];
  // the approved pictures (the first chat's block once handed on)
  const pAt = designAt(chat.messages) >= 0 ? picturesAt(chat.messages) : -1;
  const pics = pAt >= 0 && chat.messages[pAt].slides?.approved ? chat.messages[pAt].slides!.items : [];
  const [links, refLinks] = await Promise.all([pics.length ? producedLinks(user.id, chat.id) : Promise.resolve(new Map<string, string>()), uploadLinks(user.id, store.refs.map((r) => r.id))]);
  return NextResponse.json({
    store: { ...store, refs: store.refs.map((r) => ({ ...r, url: refLinks.get(r.id) ?? null })) },
    look,
    pictures: pics.map((s) => ({ n: s.n, url: links.get(s.fileId) ?? null })),
  });
});

/** Saves the store as the person edited it (lines added or removed, references added or removed). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireContentUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; store?: unknown };
  const chat = await ownChat(user.id, b.chatId);
  const next = readStore(b.store);
  // a reference must be one of the person's own ready pictures
  const { list } = await attachmentsOf(user.id, next.refs.map((r) => r.id));
  const ok = new Set(list.filter((a) => a.kind === "image").map((a) => a.id));
  const saved = await saveStore(chat.id, { ...next, refs: next.refs.filter((r) => ok.has(r.id)) });
  const refLinks = await uploadLinks(user.id, saved.refs.map((r) => r.id));
  return NextResponse.json({ store: { ...saved, refs: saved.refs.map((r) => ({ ...r, url: refLinks.get(r.id) ?? null })) } });
});
