import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { pictureReview, pictureWrite } from "@/lib/claude-code/picture";
import { canDraw, savePicture } from "@/lib/jawad/server/claude-code-picture";
import { voiceReview, voiceWrite } from "@/lib/claude-code/voice";
import { can } from "@/lib/access";
import { addContentSpent } from "@/lib/content/chats";

const UUID = /^[0-9a-f-]{36}$/i;

export const dynamic = "force-dynamic";
// a program for a big picture, then its reviews: each call waits for one long Claude answer
export const maxDuration = 800;

/** «Claude Code» in the image studio: write (or fix) the picture's program · review the rendered picture · save it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (b.action === "save") return NextResponse.json(await savePicture(user, b));
  // the voice: the studio's voices, or «حيدرة كت»'s voiceprint
  if (b.action === "voice_write" || b.action === "voice_review") {
    if (!(await can(user.email, b.from === "editor" ? "editor_ai" : "voice"))) throw new UserError("الأصوات مقفلة لحسابك حاليًا.", 403);
    const who = b.from === "editor" ? "حيدرا ماكس" : "جواد";
    return NextResponse.json(b.action === "voice_write" ? await voiceWrite(user, who, b) : await voiceReview(user, who, b));
  }
  if (!(await canDraw(user.email, b.from))) throw new UserError("صناعة الصور مقفلة لحسابك حاليًا.", 403);
  if (b.action === "write" || b.action === "review") {
    const r = b.action === "write" ? await pictureWrite(user, b) : await pictureReview(user, b);
    // «صانع المحتوى»: «حيدرا ماكس»'s code and reviews of a slide count in the conversation's «أُخذ منك في هذي المحادثة»
    if (b.from === "content" && typeof b.chatId === "string" && UUID.test(b.chatId)) await addContentSpent(user.id, b.chatId, r.worth ?? r.coins ?? 0);
    return NextResponse.json(r);
  }
  throw new UserError("طلب غير معروف.", 400);
});
