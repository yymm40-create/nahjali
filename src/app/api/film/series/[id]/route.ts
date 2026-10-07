import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireFilmApiUser } from "@/lib/film/access";
import { addEpisode, addMember, addScene, leaveSeries, moveScene, removeMember, renameSeries, requireEpisode, requireSeries, setMemberRights, setMode } from "@/lib/film/series";
import { assertTeamStage } from "@/lib/film/team";
import { fundTeam, withdrawTeam } from "@/lib/coins";
import { canEditBible, setSceneAssignee } from "@/lib/film/series";
import { editCast, generateCast, removeCast, upsertCast } from "@/lib/film/series-cast";
import { applyPlan, confirmScene, dropPlan, sceneUnderstand } from "@/lib/film/sajjad";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const ownerOnly = ["rename", "mode", "add_member", "remove_member", "member_rights", "team_fund", "team_withdraw"].includes(String(b.action));
  const { series } = await requireSeries(id, user.id, ownerOnly);
  // the series' groundwork (description, look, characters, places, plan): its leader, or whom the leader gave «📖»
  if (["bible_save", "cast_add", "cast_edit", "cast_remove", "cast_generate", "assign_scene", "add_episode"].includes(String(b.action)) && !(await canEditBible(series, user.id))) {
    throw new UserError("هذا لقائد المسلسل أو اللي أعطاه صلاحية «📖 وصف المسلسل والشخصيات والبيئات».", 403);
  }
  switch (b.action) {
    case "bible_save": {
      const patch: Record<string, string> = {};
      if (typeof b.bible === "string") patch.bible = b.bible.trim().slice(0, 30000);
      if (typeof b.style === "string") patch.style = b.style.trim().slice(0, 4000);
      if (Object.keys(patch).length) {
        const { error } = await createAdminClient().from("film_series").update(patch).eq("id", series.id);
        if (error) throw new UserError("وصف المسلسل يحتاج تجهيز قاعدة البيانات أول (ملف 0034).", 503);
        if (patch.style !== undefined) await upsertCast(series, { kind: "style", description: patch.style });
      }
      return NextResponse.json({ ok: true });
    }
    case "cast_add":
      return NextResponse.json({ id: await upsertCast(series, b) });
    case "cast_edit":
      await editCast(series, b);
      return NextResponse.json({ ok: true });
    case "cast_remove":
      await removeCast(series, b.castId);
      return NextResponse.json({ ok: true });
    case "cast_generate":
      await generateCast(series, user, b.castId);
      return NextResponse.json({ ok: true });
    case "apply_plan":
      return NextResponse.json(await applyPlan(series, user.id));
    case "drop_plan":
      await dropPlan(series, user.id);
      return NextResponse.json({ ok: true });
    case "assign_scene":
      await setSceneAssignee(series, b.sceneId, b.userId);
      return NextResponse.json({ ok: true });
    case "add_episode":
      return NextResponse.json({ id: (await addEpisode(series, b.title)).id });
    // a scene with سجاد: he reads (or writes) it and says what he understood; «صح، كمّل» makes it
    case "scene_understand":
      await assertTeamStage({ user_id: series.user_id, series_id: series.id }, user.id, "screenwriter");
      return NextResponse.json(await sceneUnderstand(series, user, b));
    case "scene_confirm":
      await assertTeamStage({ user_id: series.user_id, series_id: series.id }, user.id, "screenwriter");
      return NextResponse.json(await confirmScene(series, user.id, b));
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
