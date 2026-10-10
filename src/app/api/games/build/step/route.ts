import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requireGamesUser } from "@/lib/games/access";
import { stepArt, stepCode, type Pay } from "@/lib/games/build";
import { robotTurn } from "@/lib/claude-run";
import { GAME_BUILD } from "@config/games-build";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
// writing a whole game can take minutes: the platform's most (as the editor's route)
export const maxDuration = 800;

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * «اصنع اللعبة» · one step of a build: `part: "code"` (write, fix, or — with `change` — edit a finished game) or `part: "art"`
 * (draw the pictures). The page calls both side by side and again until they are done; a step with nothing to do answers at once.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireGamesUser();
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; part?: unknown; change?: unknown };
  const id = typeof b.id === "string" && UUID.test(b.id) ? b.id : null;
  if (!id) throw new UserError("لعبة غير صحيحة.", 400);
  if (b.part === "art") return NextResponse.json({ build: await stepArt(user, id, new URL(req.url).origin) });
  if (b.part !== "code") throw new UserError("طلب غير صحيح.", 400);
  const change = typeof b.change === "string" ? b.change.slice(0, GAME_BUILD.changeMax) : undefined;
  const pay: Pay = (run) => robotTurn(user, GAME_BUILD.model, change !== undefined ? "قنبر يعدّل لعبة" : "قنبر يكتب كود لعبة", run);
  try {
    return NextResponse.json({ build: await stepCode(user, id, change, pay) });
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    console.error("games build step", e);
    const raw = e instanceof Error ? e.message : String(e);
    throw new UserError(`صار خطأ أثناء بناء اللعبة؛ جرّب بعد شوي.${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`, 502);
  }
});
