import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { handle, UserError } from "@/lib/api";
import { requireDesignerUser } from "@/lib/designer/access";
import { getChat, saveChat, type PendingDesign, type Turn } from "@/lib/designer/chats";
import { sizeOf, type Design } from "@/lib/designer/layers";
import { codeFits, isMajlisMaker, orderMissing, orderSummary, readOrder, templateOf } from "@config/designer-majlis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «المصمم الذكي كاظم» · a ready majlis design ordered from the picker: the person's message and the design that answers it
 * go into the conversation, and the order waits for the produce step (which the page starts at once): «حيدرا ماكس»
 * draws the template's exact program in the page, or GPT Image 2.6 (Sunburst / Flare) / GPT Image 2 rebuilds it.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; order?: unknown; maker?: unknown };
  const order = readOrder(b.order);
  if (!order) throw new UserError("اختر تصميمًا وعبّ بياناته.", 400);
  const missing = orderMissing(order);
  if (missing.length) throw new UserError(`ناقص: ${missing.join("، ")}.`, 400);
  if (!isMajlisMaker(b.maker)) throw new UserError("اختر مين يسوي التصميم.", 400);
  const maker = b.maker;
  const t = templateOf(order)!;
  if (maker === "code" && !codeFits(t, order)) throw new UserError("هذا التصميم عنوانه للزهراء عليها السلام؛ لمناسبة ثانية يسويه جواد (GPT) بعنوان المناسبة، أو اختر تصميمًا عامًا.", 400);
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  const chat = chatId ? await getChat(user.id, chatId) : null;
  if (chatId && !chat) throw new UserError("ما لقينا هذي المحادثة.", 404);

  const summary = orderSummary(order, maker);
  const design: Design = { id: randomUUID().slice(0, 8), aspect: t.aspect, ...sizeOf(t.aspect), artwork: null, textMode: "baked", layers: [], state: "drawing" };
  const mine: Turn = { role: "user", text: summary };
  const answer: Turn = { role: "assistant", text: maker === "code" ? "تمام 🤍 حيدرا ماكس يجهّز تصميمك الحين بنفس الشكل اللي اخترته، بصورك وبياناتك." : `تمام 🤍 جواد يجهّز تصميمك الحين بـ ${maker === "gpt2" ? "GPT Image 2" : `GPT Image 2.6 · ${maker === "flare" ? "Flare" : "Sunburst"}`}.`, design };
  const messages = [...(chat?.messages ?? []), mine, answer];
  const at = messages.length - 1;

  // the order waits for the produce step: «حيدرا ماكس» draws it in the page (cutting the people out first when asked),
  // or GPT Image 2.6 / 2 makes it on the server — either way a failure can be tried again with the same order
  const pending: PendingDesign = { id: design.id, at, kind: "other", aspect: t.aspect, textMode: "baked", artwork: summary, refs: order.people.map((p) => p.photo), layers: [], keep: null, maker: "code", place: order.people.map((p) => p.photo), majlis: order, majlisMaker: maker };
  const id = await saveChat(user.id, chatId, { messages, pending });
  return NextResponse.json({ chatId: id, mode: maker === "code" ? "code" : "gpt" });
});
