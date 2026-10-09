import { NextResponse } from "next/server";
import sharp from "sharp";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { getChat, lastDesignAt, saveChat } from "@/lib/designer/chats";
import { addFile, fileLinks } from "@/lib/designer/files";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_BYTES = 30 * 1024 * 1024;

/**
 * «المصمم الذكي» · the final PNG the browser drew from the artwork and the layers, kept with the conversation (so it is
 * there after a reload and «كاظم» knows it was saved). Body: multipart with `chatId` and `file`.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const form = await req.formData().catch(() => null);
  const chatId = String(form?.get("chatId") ?? "");
  const file = form?.get("file");
  if (!UUID.test(chatId) || !(file instanceof Blob)) throw new UserError("طلب غير صحيح.", 400);
  if (file.size > MAX_BYTES) throw new UserError("الصورة أكبر من المسموح.", 413);
  const bytes = Buffer.from(await file.arrayBuffer());
  const meta = await sharp(bytes, { failOn: "none" }).metadata().catch(() => null);
  if (!meta || meta.format !== "png" || !meta.width || !meta.height) throw new UserError("الملف ليس صورة PNG.", 400);
  const chat = await getChat(user.id, chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const at = lastDesignAt(chat.messages);
  if (at < 0) throw new UserError("ما فيه تصميم في هذي المحادثة.", 409);
  const saved = await addFile({ userId: user.id, chatId, bytes, name: `design-${chat.messages[at].design!.id}`, role: "final", width: meta.width, height: meta.height });
  const messages = [...chat.messages];
  messages[at] = { ...messages[at], design: { ...messages[at].design!, final: saved.id } };
  await saveChat(user.id, chatId, { messages });
  const downloads = await fileLinks(user.id, chatId, true);
  return NextResponse.json({ ok: true, fileId: saved.id, url: downloads.get(saved.id) ?? null });
});
