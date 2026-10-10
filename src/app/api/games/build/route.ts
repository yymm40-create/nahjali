import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requireGamesUser } from "@/lib/games/access";
import { deleteBuild, getBuild, listBuilds, picturesQuote, startBuild } from "@/lib/games/build";
import { robotTurn } from "@/lib/claude-run";
import { GAME_BUILD } from "@config/games-build";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

const UUID = /^[0-9a-f-]{36}$/i;

/** «اصنع اللعبة» · my games: one (`?id=`), those of a conversation (`?chatId=`), all of them, or what the pictures cost (`?quote=1`). */
export const GET = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const q = new URL(req.url).searchParams;
  if (q.get("quote")) return NextResponse.json(await picturesQuote(user, new URL(req.url).origin));
  const id = q.get("id");
  if (id) {
    if (!UUID.test(id)) throw new UserError("لعبة غير صحيحة.", 400);
    const build = await getBuild(user.id, id);
    if (!build) throw new UserError("ما لقينا هذي اللعبة.", 404);
    return NextResponse.json({ build });
  }
  const chatId = q.get("chatId");
  if (chatId && !UUID.test(chatId)) throw new UserError("محادثة غير صحيحة.", 400);
  return NextResponse.json({ builds: await listBuilds(user.id, chatId) });
});

/** «🎮 اصنع اللعبة»: «قنبر» plans the game of this conversation (its code and pictures follow, see ./step). */
export const POST = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const b = (await req.json().catch(() => ({}))) as { chatId?: unknown; pictures?: unknown };
  const chatId = typeof b.chatId === "string" && UUID.test(b.chatId) ? b.chatId : null;
  if (!chatId) throw new UserError("تكلّم مع قنبر عن لعبتك أول، وبعدين اضغط «اصنع اللعبة».");
  try {
    return NextResponse.json(await robotTurn(user, GAME_BUILD.model, "قنبر يخطط لعبة", () => startBuild(user, chatId, b.pictures !== false)));
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    console.error("games build", e);
    const raw = e instanceof Error ? e.message : String(e);
    throw new UserError(`ما قدر قنبر يبدأ بناء اللعبة الحين؛ جرّب بعد شوي.${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`, 502);
  }
});

export const DELETE = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!UUID.test(id)) throw new UserError("لعبة غير صحيحة.", 400);
  await deleteBuild(user.id, id);
  return NextResponse.json({ ok: true });
});
