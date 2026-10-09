import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { ask, type Turn } from "@/lib/islamic/ask";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/** «الذكاء الإسلامي» · a question. The private trial: the owner only (opened to others later, the owner's decision). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("هذا القسم في تجربة خاصة الحين.", 403);
  const b = (await req.json().catch(() => ({}))) as { question?: unknown; history?: unknown };
  const question = String(b.question ?? "").trim();
  if (!question) throw new UserError("اكتب سؤالك.");
  const history = (Array.isArray(b.history) ? b.history : [])
    .filter((t): t is Turn => Boolean(t && typeof t === "object" && (t as Turn).role && typeof (t as Turn).text === "string"))
    .map((t) => ({ role: t.role === "assistant" ? "assistant" : "user", text: String(t.text).slice(0, 6000) }) as Turn)
    .slice(-10);
  try {
    return NextResponse.json(await ask(user.id, question, history, user.email));
  } catch (e) {
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    throw e;
  }
});
