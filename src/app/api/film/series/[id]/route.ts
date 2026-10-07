import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireFilmApiUser } from "@/lib/film/access";
import { addEpisode, addMember, addScene, leaveSeries, moveScene, removeMember, renameSeries, requireEpisode, requireSeries, setMemberRights, setMode } from "@/lib/film/series";
import { assertTeamStage } from "@/lib/film/team";
import { fundTeam, withdrawTeam } from "@/lib/coins";
import { assembleEpisode } from "@/lib/editor/episode";

export const maxDuration = 60;

/**
 * «المسلسل الذكي»: episodes, scenes, the team, and assembling an episode. The owner decides the name, the mode and
 * the team; in team mode its members also add scenes and assemble episodes (all on the owner's coins).
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireFilmApiUser();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = (await params).id;
  const ownerOnly = ["rename", "mode", "add_member", "remove_member", "add_episode", "member_rights", "team_fund", "team_withdraw"].includes(String(b.action));
  const { series } = await requireSeries(id, user.id, ownerOnly);
  switch (b.action) {
    case "add_episode":
      return NextResponse.json({ id: (await addEpisode(series, b.title)).id });
    case "add_scene":
      // a new scene starts with the screenwriter
      await assertTeamStage({ user_id: series.user_id, series_id: series.id }, user.id, "screenwriter");
      return NextResponse.json({ id: await addScene(series, b) });
    case "move_scene":
      await moveScene(series, b.sceneId, b.by);
      return NextResponse.json({ ok: true });
    case "rename":
      await renameSeries(series, b);
      return NextResponse.json({ ok: true });
    case "mode":
      await setMode(series, b.mode);
      return NextResponse.json({ ok: true });
    case "add_member":
      return NextResponse.json(await addMember(series, b.username));
    case "remove_member":
      await removeMember(series, b.userId);
      return NextResponse.json({ ok: true });
    case "leave":
      await leaveSeries(series, user.id);
      return NextResponse.json({ ok: true });
    case "member_rights":
      await setMemberRights(series, b);
      return NextResponse.json({ ok: true });
    // «نقود الفريق الذكي»: the owner moves coins from their own into the team's wallet, or back
    case "team_fund":
      return NextResponse.json({ balance: await fundTeam(user, series.id, Number(b.coins)) });
    case "team_withdraw":
      await withdrawTeam(user, series.id, Number(b.coins));
      return NextResponse.json({ ok: true });
    case "assemble":
      await assertTeamStage({ user_id: series.user_id, series_id: series.id }, user.id, "montage");
      return NextResponse.json(await assembleEpisode(series, await requireEpisode(series, b.episodeId), user.id));
    default:
      throw new UserError("طلب غير معروف.", 400);
  }
});
