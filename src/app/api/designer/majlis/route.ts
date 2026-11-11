import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { handle, UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { requireDesignerUser } from "@/lib/designer/access";
import { getChat, saveChat, type PendingDesign, type Turn } from "@/lib/designer/chats";
import { addFileFromOutput, fileLinks } from "@/lib/designer/files";
import { sizeOf, type Design } from "@/lib/designer/layers";
import { majlisGptPrompt } from "@/lib/designer/majlis";
import { deskImage, deskReference, DeskError, type DeskWho } from "@/lib/content/jawad";
import { baseUrl, isMajlisMaker, orderMissing, orderSummary, readOrder, templateById } from "@config/designer-majlis";
import { GPT_IMAGE_26_ID } from "@config/jawad/generators";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «المصمم الذكي كاظم» · a ready majlis design ordered from the picker: the person's message and the design that answers it
 * go into the conversation. «حيدرا ماكس» (code): the order waits for the page to draw the template's exact program (the
 * produce step). GPT Image 2.6 (Sunburst / Flare) or GPT Image 2: the picked design is rebuilt with the people now.
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
  const t = templateById(order.templateId)!;
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  const chat = chatId ? await getChat(user.id, chatId) : null;
  if (chatId && !chat) throw new UserError("ما لقينا هذي المحادثة.", 404);

  const summary = orderSummary(order, maker);
  const design: Design = { id: randomUUID().slice(0, 8), aspect: t.aspect, ...sizeOf(t.aspect), artwork: null, textMode: "baked", layers: [], state: "drawing" };
  const mine: Turn = { role: "user", text: summary };
  const answer: Turn = { role: "assistant", text: maker === "code" ? "تمام 🤍 حيدرا ماكس يجهّز تصميمك الحين بنفس الشكل اللي اخترته، بصورك وبياناتك." : `تمام 🤍 جواد يجهّز تصميمك الحين بـ ${maker === "gpt2" ? "GPT Image 2" : `GPT Image 2.6 · ${maker === "flare" ? "Flare" : "Sunburst"}`}.`, design };
  const messages = [...(chat?.messages ?? []), mine, answer];
  const at = messages.length - 1;

  if (maker === "code") {
    // the background choice is carried out by «حيدرا ماكس» when he draws it (the produce step cuts the people out first)
    const pending: PendingDesign = { id: design.id, at, kind: "other", aspect: t.aspect, textMode: "baked", artwork: summary, refs: order.people.map((p) => p.photo), layers: [], keep: null, maker: "code", place: order.people.map((p) => p.photo), majlis: order };
    const id = await saveChat(user.id, chatId, { messages, pending });
    return NextResponse.json({ chatId: id, mode: "code" });
  }

  // GPT: the conversation is kept first (a reload shows the design drawing), then the picture is made
  const id = await saveChat(user.id, chatId, { messages, pending: null });
  const origin = new URL(req.url).origin;
  const fail = async (why: string) => {
    messages[at] = { ...answer, design: { ...design, state: "failed", error: why.slice(0, 300) } };
    await saveChat(user.id, id, { messages }).catch(() => null);
  };
  try {
    const res = await fetch(origin + baseUrl(t.id));
    if (!res.ok) throw new UserError("ما قدرنا نفتح التصميم المختار.", 502);
    const ref1 = await deskReference(user.id, Buffer.from(await res.arrayBuffer()), `majlis-${t.id}`);
    const who: DeskWho = { id: user.id, email: user.email, owner: await unlimitedFor(user.email), origin };
    const refs = [{ uploadId: ref1, name: "ref1" }, ...order.people.map((p, i) => ({ uploadId: p.photo, name: `ref${i + 2}` }))];
    const r = await deskImage(who, { key: `mj-${randomUUID().replace(/-/g, "")}`, kind: "image", generatorId: maker === "gpt2" ? "openai-gpt-image-2" : GPT_IMAGE_26_ID, ...(maker === "gpt2" ? {} : { variant: maker }), prompt: majlisGptPrompt(t, order), aspect: "2:3", resolution: "hi", quality: "high", refs });
    const file = await addFileFromOutput({ userId: user.id, chatId: id, out: r.out, name: `artwork-${design.id}`, meta: { prompt: summary, aspect: t.aspect, kind: "other", textMode: "baked", maker, majlis: order, desk: r.receipt } });
    const done: Design = { ...design, artwork: file.id, width: r.out.width ?? design.width, height: r.out.height ?? design.height, state: "ready" };
    messages[at] = { ...answer, design: done };
    await saveChat(user.id, id, { messages });
    const links = await fileLinks(user.id, id);
    return NextResponse.json({ chatId: id, mode: "gpt", design: { ...done, artworkUrl: links.get(file.id) ?? null } });
  } catch (e) {
    const why = e instanceof DeskError ? e.reason : e instanceof UserError ? e.message : "ما قدرنا نسوي التصميم الحين؛ جرّب مرة ثانية.";
    if (!(e instanceof UserError)) console.error("designer majlis", e instanceof DeskError ? e.detail : e);
    await fail(why);
    throw new UserError(`${why}${isAdmin(user.email) && e instanceof DeskError ? ` (${String(e.detail).slice(0, 200)})` : ""}`, 502);
  }
});
