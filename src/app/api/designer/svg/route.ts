import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { handle, UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { requireDesignerUser } from "@/lib/designer/access";
import { getChat, lastDesignAt } from "@/lib/designer/chats";
import { addFileFromOutput, fileLinks } from "@/lib/designer/files";
import { createAdminClient } from "@/lib/supabase/admin";
import { deskImage, DeskError, type DeskWho } from "@/lib/content/jawad";
import { readOrder, templateOf } from "@config/designer-majlis";
import { GPT_IMAGE_26_ID } from "@config/jawad/generators";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «✒️ العنوان SVG»: the design's calligraphy title drawn again as a VECTOR drawing by GPT Image 2.6 (its SVG output,
 * from text only), for banners and big prints: it grows to any size without blur. Answers with a link to the SVG.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireDesignerUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  const chat = chatId ? await getChat(user.id, chatId) : null;
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  const at = lastDesignAt(chat.messages);
  const d = at >= 0 ? chat.messages[at].design : undefined;
  if (!d?.artwork || d.state !== "ready") throw new UserError("ما فيه تصميم جاهز.", 409);
  const { data } = await createAdminClient().from("designer_files").select("meta").eq("id", d.artwork).eq("user_id", user.id).maybeSingle();
  const meta = (data?.meta ?? {}) as Record<string, unknown>;
  const order = readOrder(meta.majlis);
  const t = order ? templateOf(order) : null;
  const title = t?.title ?? "";
  const brief = typeof meta.prompt === "string" ? meta.prompt.slice(0, 1500) : "";
  const prompt = title
    ? `A refined VECTOR illustration (SVG): the Arabic calligraphy title «${title}» in rich gold thuluth calligraphy with a dignified mourning ornament (a thin arabesque frame and a small crescent motif) around it, for a Husseini majlis invitation for the martyrdom of Lady Fatima al-Zahra. The Arabic is written exactly as given, letters correctly joined right to left. Flat vector shapes and gradients only, no photo, no people, transparent background, no other words.`
    : `A refined VECTOR illustration (SVG) of the main title and ornament of this design, for big prints: ${brief}. Arabic written exactly, joined right to left. Flat vector shapes and gradients only, no photo, no people, transparent background.`;
  const who: DeskWho = { id: user.id, email: user.email, owner: await unlimitedFor(user.email), origin: new URL(req.url).origin };
  try {
    const r = await deskImage(who, { key: `svg-${randomUUID().replace(/-/g, "")}`, kind: "image", generatorId: GPT_IMAGE_26_ID, variant: "sunburst", format: "svg", prompt, aspect: "3:2", quality: "high" });
    const file = await addFileFromOutput({ userId: user.id, chatId: chat.id, out: r.out, name: `title-svg-${d.id}`, meta: { svg: true, from: d.artwork, desk: r.receipt } });
    const url = (await fileLinks(user.id, chat.id, true)).get(file.id) ?? null;
    return NextResponse.json({ url, mime: r.out.mime });
  } catch (e) {
    if (e instanceof DeskError) throw new UserError(e.reason, 502);
    throw e;
  }
});
