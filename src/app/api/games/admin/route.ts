import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { getVisibility, setVisibility } from "@/lib/games/access";
import { countGames, listGames, parseGameLines, putGames, removeGames, updateGame } from "@/lib/games/library";
import { getPersona, resetPersona, savePersona } from "@/lib/games/persona";
import { deleteRun, ESTIMATE_USD, listRuns, runStatus, startRun, stepRun, worst, type Mode } from "@/lib/games/tests";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The dashboard's view: the persona, the library, the latest test runs. */
export const GET = handle(async (req: Request) => {
  await owner();
  const run = new URL(req.url).searchParams.get("run");
  if (run) return NextResponse.json({ status: await runStatus(run), worst: await worst(run) });
  const [persona, games, count, runs, visibility] = await Promise.all([getPersona(), listGames(), countGames(), listRuns(), getVisibility()]);
  return NextResponse.json({ visibility, persona, games, count, runs, estimate: ESTIMATE_USD });
});

/** One action of the dashboard (see /admin/games). */
export const POST = handle(async (req: Request) => {
  await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  try {
    switch (b.action) {
      case "visibility":
        await setVisibility(b.value as "owner" | "codes" | "all");
        return NextResponse.json({ ok: true });
      case "persona_save":
        await savePersona(String(b.text ?? ""));
        return NextResponse.json({ ok: true });
      case "persona_reset":
        await resetPersona();
        return NextResponse.json({ ok: true });
      case "games_add": {
        const items = parseGameLines(String(b.text ?? "")).slice(0, 2000);
        if (!items.length) throw new UserError("ما لقيت ألعاب في النص.");
        return NextResponse.json(await putGames(items));
      }
      case "games_update":
        await updateGame(id, {
          ...(typeof b.genre === "string" ? { genre: b.genre.slice(0, 120) } : {}),
          ...(typeof b.players === "string" ? { players: b.players.slice(0, 120) } : {}),
          ...(typeof b.notes === "string" ? { notes: b.notes.slice(0, 8000) } : {}),
          ...(b.status === "approved" || b.status === "draft" ? { status: b.status } : {}),
        });
        return NextResponse.json({ ok: true });
      case "games_remove":
        await removeGames(Array.isArray(b.ids) ? b.ids.map(String).slice(0, 500) : [id]);
        return NextResponse.json({ ok: true });
      case "test_start": {
        const mode: Mode = b.mode === "deep" ? "deep" : "quick";
        const count = Math.max(1, Math.min(1000, Math.floor(Number(b.count)) || 100));
        return NextResponse.json(await startRun(count, mode, String(b.label ?? "")));
      }
      case "test_step":
        return NextResponse.json(await stepRun(id, 3));
      case "test_delete":
        await deleteRun(id);
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    throw e;
  }
  throw new UserError("إجراء غير معروف.");
});
