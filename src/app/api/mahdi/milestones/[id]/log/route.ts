import { NextResponse } from "next/server";
import { MAHDI_LIMITS } from "@config/mahdi";
import { addDays, todayIn } from "@/lib/mahdi/engine";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { checkGoals, findMilestone } from "@/lib/mahdi/server/goals";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { parseDate } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Sets what was done towards a milestone on one day (`value` is the day's total; 0 clears it). */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  if (!(await findMilestone(supabase, id))) throw new UserError(t.errors.notFound, 404);

  const today = todayIn(profile.timeZone);
  const date = body.date === undefined ? today : parseDate(body.date);
  if (date > today) throw new UserError(t.errors.futureDate, 400);
  if (date < addDays(today, -5 * 366)) throw new UserError(t.errors.invalid, 400);
  const value = typeof body.value === "number" ? body.value : Number(body.value);
  if (!Number.isFinite(value) || value < 0 || value > MAHDI_LIMITS.maxValue) throw new UserError(t.errors.invalid, 400);

  if (value === 0) checkGoals(await supabase.from("mahdi_milestone_logs").delete().eq("milestone_id", id).eq("log_date", date));
  else
    checkGoals(
      await supabase
        .from("mahdi_milestone_logs")
        .upsert({ milestone_id: id, user_id: user.id, log_date: date, value: Math.round(value * 100) / 100 }, { onConflict: "milestone_id,log_date" }),
    );
  return NextResponse.json({ snapshot: await loadSnapshot(supabase, profile) });
});
