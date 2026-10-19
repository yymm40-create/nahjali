import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { dailyQuarters, QUARTERS } from "@/lib/mahdi/khatma/mine";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { linkHabit, loadMyKhatma, readQuarters, startMyKhatma, stopMyKhatma, unreadQuarter, updateMyKhatma } from "@/lib/mahdi/server/my-khatma";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { cleanLine, parseIntIn } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

/** «ختمتي»: my own khatma now, what I read in it, and the ones before. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user, profile } = await requireProfile(req);
  return NextResponse.json({ ...(await loadMyKhatma(createAdminClient(), user.id)), today: todayIn(profile.timeZone) }, { headers: { "Cache-Control": "private, no-store" } });
});

const quarter = (v: unknown) => parseIntIn(v, 1, QUARTERS);

/**
 * «ختمتي» actions: start { days, dedicatedTo, forSoulOf } · read { quarters: [] } · unread { quarter } ·
 * update { days, dedicatedTo, forSoulOf } · stop · link { habitId | null } · habit_new { projectId? } (a habit made for it).
 * The habit's log is moved by the page (like every other log), with what these return.
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const body = await readJson(req);
  const db = createAdminClient();
  const today = todayIn(profile.timeZone);
  switch (body.action) {
    case "start":
      await startMyKhatma(db, user.id, today, parseIntIn(body.days, 1, 365), cleanLine(body.dedicatedTo, 120), cleanLine(body.forSoulOf, 120));
      return NextResponse.json({ ok: true });
    case "read": {
      if (!Array.isArray(body.quarters) || !body.quarters.length || body.quarters.length > QUARTERS) throw new UserError(t.errors.invalid, 400);
      const r = await readQuarters(db, user.id, today, [...new Set(body.quarters.map(quarter))]);
      return NextResponse.json({ ...r, today });
    }
    case "unread":
      return NextResponse.json(await unreadQuarter(db, user.id, quarter(body.quarter)));
    case "update":
      await updateMyKhatma(db, user.id, {
        ...(body.days !== undefined ? { days: parseIntIn(body.days, 1, 365) } : {}),
        ...(body.dedicatedTo !== undefined ? { dedicated_to: cleanLine(body.dedicatedTo, 120) } : {}),
        ...(body.forSoulOf !== undefined ? { for_soul_of: cleanLine(body.forSoulOf, 120) } : {}),
      });
      return NextResponse.json({ ok: true });
    case "stop":
      await stopMyKhatma(db, user.id, today);
      return NextResponse.json({ ok: true });
    case "link": {
      let habitId: string | null = null;
      if (body.habitId !== null) {
        habitId = requireId(body.habitId);
        // the person's own client: only their habits are visible to it
        const { data } = await supabase.from("mahdi_habits").select("id").eq("id", habitId).maybeSingle();
        if (!data) throw new UserError(t.errors.notFound, 404);
      }
      await linkHabit(db, user.id, habitId);
      return NextResponse.json({ ok: true });
    }
    case "habit_new": {
      // a habit made for the khatma: «ورد الختمة العلوية», counted in hizb quarters, today's portion as its daily goal
      const mine = await loadMyKhatma(db, user.id);
      if (!mine.ready || !mine.current || mine.current.status !== "open") throw new UserError("ابدأ ختمتك أول.", 409);
      const [{ count: habits }, { count: projects }] = await Promise.all([
        supabase.from("mahdi_habits").select("id", { count: "exact", head: true }),
        supabase.from("mahdi_projects").select("id", { count: "exact", head: true }),
      ]);
      if ((habits ?? 0) + 1 > MAHDI_LIMITS.maxHabits) throw new UserError(t.errors.tooMany, 403);
      let projectId: string;
      if (body.projectId) {
        projectId = requireId(body.projectId);
        const p = (await supabase.from("mahdi_projects").select("id, archived_at").eq("id", projectId).maybeSingle()).data;
        if (!p) throw new UserError(t.errors.notFound, 404);
        if (p.archived_at) throw new UserError(t.errors.archivedProject, 409);
      } else {
        if ((projects ?? 0) + 1 > MAHDI_LIMITS.maxProjects) throw new UserError(t.errors.tooMany, 403);
        projectId = (check(await supabase.from("mahdi_projects").insert({ user_id: user.id, name: "الختمة العلوية", icon: "📖", color: "emerald", sort_order: projects ?? 0 }).select("id").single()) as { id: string }).id;
      }
      const habitId = check(
        await supabase.rpc("mahdi_create_habit", {
          p_project: projectId,
          p_name: "ورد الختمة العلوية",
          p_icon: "📖",
          p_category: "القرآن",
          p_notes: "يتسجل وحده من «الختمة العلوية»: كل ربع حزب تقرؤه هناك يضيف واحد.",
          p_reminder: null,
          p_start: today,
          p_measure: "count",
          p_target: dailyQuarters(mine.current.days),
          p_unit: "ربع",
          p_freq: "daily",
          p_days: [],
        }),
      ) as string;
      await linkHabit(db, user.id, habitId);
      return NextResponse.json({ habitId, snapshot: await loadSnapshot(supabase, profile) });
    }
  }
  throw new UserError(t.errors.invalid, 400);
});
