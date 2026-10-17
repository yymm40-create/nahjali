import { handle, UserError } from "@/lib/api";
import { requireKharqUser } from "@/lib/kharq/access";
import { getChat } from "@/lib/kharq/chats";
import { playCsp } from "@config/games-build";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «محمد الخارق» · a page he wrote in code (Claude Code), for the person who owns the conversation: shown inside a frame
 * in the conversation, fenced off exactly like a built game — its own sandbox (none of the site's cookies or storage,
 * no network, nothing sent anywhere). It runs on the person's device only; the server never runs it.
 */
export const GET = handle(async (req: Request) => {
  const { user } = await requireKharqUser();
  const url = new URL(req.url);
  const chatId = url.searchParams.get("chat") ?? "";
  const at = Number(url.searchParams.get("turn"));
  if (!UUID.test(chatId) || !Number.isInteger(at) || at < 0) throw new UserError("رابط غير صحيح.", 400);
  const chat = await getChat(user.id, chatId);
  const d = chat?.messages[at]?.deliver;
  if (!d || d.kind !== "code" || !d.text.trim()) throw new UserError("ما لقينا هذي الصفحة.", 404);
  return new Response(d.text, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": playCsp(url.origin),
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
});
