import { NextResponse } from "next/server";
import { cleanPlan } from "@/lib/mahdi/health/plan";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { missingTable } from "@/lib/mahdi/server/inbox";

/** «الصحة العلوية»: my saved plan (null when none). `ready` is false until SQL 0059 runs (the page keeps it on the device). */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const { data, error } = await supabase.from("mahdi_health").select("plan").maybeSingle();
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, plan: null });
    throw error;
  }
  return NextResponse.json({ ready: true, plan: cleanPlan(data?.plan) });
});

/** Saves the plan (profile, nutrition targets, training table). */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const plan = cleanPlan((await readJson(req)).plan);
  if (!plan) throw new UserError(t.errors.invalid, 400);
  const { error } = await supabase.from("mahdi_health").upsert({ user_id: user.id, plan, updated_at: new Date().toISOString() });
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, plan });
    throw error;
  }
  return NextResponse.json({ ready: true, plan });
});
