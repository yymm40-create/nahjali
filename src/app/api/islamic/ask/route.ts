import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { ask } from "@/lib/islamic/ask";
import { cleanTurns, getChat, saveChat, type ChatTurn } from "@/lib/islamic/chats";
import { isIslamicMode } from "@/lib/islamic/text";
import { robotTurn } from "@/lib/claude-run";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
// the deep research searches the library many times before it writes: as long as the platform allows
export const maxDuration = 800;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «الذكاء الإسلامي» · a question, in a conversation that is remembered: `{ question, chatId?, mode, history? }`
 * (`history` only when the memory isn't set up yet). The private trial: the owner only.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("هذا القسم في تجربة خاصة الحين.", 403);
  const b = (await req.json().catch(() => ({}))) as { question?: unknown; history?: unknown; model?: unknown; chatId?: unknown; mode?: unknown };
  const question = String(b.question ?? "").trim();
  if (!question) throw new UserError("اكتب سؤالك.");
  const mode = isIslamicMode(b.mode) ? b.mode : "auto";
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  // the memory: the conversation as kept on the server (or, before SQL 0052, as the page has it)
  const kept = chatId ? await getChat(user.id, chatId) : null;
  const before: ChatTurn[] = kept ? kept.messages : cleanTurns(b.history, 40);
  try {
    const r = await robotTurn(user, b.model, mode === "research" ? "بحث وتحليل في الذكاء الإسلامي" : "سؤال للذكاء الإسلامي", () => ask(user.id, question, before, user.email, mode));
    const messages: ChatTurn[] = [...before, { role: "user", text: question, mode }, { role: "assistant", text: r.answer, mode, sources: r.sources, found: r.found }];
    const id = await saveChat(user.id, kept?.id ?? null, messages, r.usd);
    return NextResponse.json({ ...r, chatId: id });
  } catch (e) {
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    throw e;
  }
});
