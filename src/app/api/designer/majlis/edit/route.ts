import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { getChat, lastDesignAt, saveChat, type PendingDesign, type Turn } from "@/lib/designer/chats";
import { readProgram } from "@/lib/designer/program";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMajlisMaker, readOrder, templateOf } from "@config/designer-majlis";
import type { Design } from "@/lib/designer/layers";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «المصمم الذكي كاظم» · a change to the ready majlis design that stands («كبّر الاسم»، «غيّر لون العنوان»), said in the
 * chat: the same design is changed, not made again — «حيدرا ماكس» patches its program, or GPT edits its picture — in
 * the produce step the page starts at once.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; said?: unknown };
  const said = typeof b.said === "string" ? b.said.replace(/\s+/g, " ").trim().slice(0, 1000) : "";
  if (!said) throw new UserError("اكتب وش تبي يتغيّر.", 400);
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  const chat = chatId ? await getChat(user.id, chatId) : null;
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const at0 = lastDesignAt(chat.messages);
  const prev = at0 >= 0 ? chat.messages[at0].design : undefined;
  if (!prev?.majlis || prev.state !== "ready" || !prev.artwork) throw new UserError("ما فيه تصميم جاهز نعدّله هنا.", 409);
  const { data } = await createAdminClient().from("designer_files").select("meta").eq("id", prev.artwork).eq("user_id", user.id).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const order = readOrder(meta.majlis);
  const t = order ? templateOf(order) : null;
  if (!order || !t) throw new UserError("ما لقينا طلب هذا التصميم؛ اطلبه من جديد من «دعوة مجلس».", 409);
  const maker = isMajlisMaker(meta.maker) ? meta.maker : "code";
  const program = readProgram(meta.program);

  const design: Design = { id: randomUUID().slice(0, 8), aspect: prev.aspect, width: prev.width, height: prev.height, artwork: null, textMode: "baked", layers: [], state: "drawing", majlis: t.id };
  const mine: Turn = { role: "user", text: said };
  const answer: Turn = { role: "assistant", text: maker === "code" ? "تمام 🤍 حيدرا ماكس يعدّل نفس التصميم." : "تمام 🤍 جواد يعدّل نفس التصميم.", design };
  const messages = [...chat.messages, mine, answer];
  const pending: PendingDesign = {
    id: design.id,
    at: messages.length - 1,
    kind: "other",
    aspect: prev.aspect,
    textMode: "baked",
    artwork: typeof meta.prompt === "string" && meta.prompt ? meta.prompt : said,
    refs: order.people.map((p) => p.photo),
    layers: [],
    keep: null,
    maker: "code",
    place: order.people.map((p) => p.photo),
    // the same photos and the same background choice: cut out again when they were cut in the page (only the
    // server's cut is kept as photos of their own — `cutDone` says so)
    majlis: order,
    majlisMaker: maker,
    majlisEdit: { said, prev: prev.artwork, ...(maker === "code" && program ? { code: program.code, fonts: program.fonts } : {}) },
  };
  await saveChat(user.id, chat.id, { messages, pending });
  return NextResponse.json({ chatId: chat.id });
});
