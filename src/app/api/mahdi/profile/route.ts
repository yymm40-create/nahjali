import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAHDI_LIMITS } from "@config/mahdi";
import { MILESTONES } from "@config/mahdi-rewards";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireUser, UserError } from "@/lib/mahdi/server/api";
import { profileFromRow, type ProfileRow } from "@/lib/mahdi/server/rows";
import { getShrines } from "@/lib/mahdi/server/snapshot";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { parseBool, parseIntIn, parseTheme, parseTimeZone, requireName } from "@/lib/mahdi/server/validate";

async function profileFields(supabase: SupabaseClient, body: Record<string, unknown>, creating: boolean) {
  const out: Record<string, unknown> = {};
  if ("displayName" in body || creating) out.display_name = requireName(body.displayName, MAHDI_LIMITS.nameMax, t.onboarding.nameRequired);
  if ("shrineId" in body) {
    const shrine = (await getShrines()).find((s) => s.id === body.shrineId && s.active && s.imageUrl);
    if (!shrine) throw new UserError(t.errors.invalid, 400);
    out.shrine_id = shrine.id;
  }
  if ("theme" in body) out.theme = parseTheme(body.theme);
  if ("timeZone" in body) out.time_zone = parseTimeZone(body.timeZone);
  if ("weekStart" in body) out.week_start = parseIntIn(body.weekStart, 0, 6);
  if ("showHijri" in body) out.show_hijri = parseBool(body.showHijri);
  if ("hijriOffset" in body) out.hijri_offset = parseIntIn(body.hijriOffset, -2, 2);
  // Rewards: only what the user has unlocked
  if ("frame" in body || "themeVariant" in body || "viewMode" in body) {
    const unlocked = new Set((await supabase.from("mahdi_user_rewards").select("milestone_id")).data?.map((r) => r.milestone_id) ?? []);
    const opened = MILESTONES.filter((m) => unlocked.has(m.id)).map((m) => m.reward);
    const allowed = (ok: boolean) => {
      if (!ok) throw new UserError(t.errors.invalid, 400);
    };
    if ("frame" in body) {
      allowed(body.frame === "" || opened.some((r) => r.type === "frame" && r.value === body.frame));
      out.frame = body.frame;
    }
    if ("themeVariant" in body) {
      allowed(body.themeVariant === "" || opened.some((r) => r.type === "variant" && r.value === body.themeVariant));
      out.theme_variant = body.themeVariant;
    }
    if ("viewMode" in body) {
      allowed(body.viewMode === "list" || opened.some((r) => r.type === "view" && r.value === body.viewMode));
      out.view_mode = body.viewMode;
    }
  }
  return out;
}

/** Onboarding: creates the user's «لأجل المهدي» profile (name, shrine, look, time zone). */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireUser(req);
  const fields = await profileFields(supabase, await readJson(req), true);
  const query = profile
    ? supabase.from("mahdi_profiles").update(fields).eq("user_id", user.id)
    : supabase.from("mahdi_profiles").insert({ user_id: user.id, ...fields });
  const row = check(await query.select("*").single());
  return NextResponse.json({ profile: profileFromRow(row as ProfileRow) });
});

/** Changes some of the profile settings. */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireUser(req);
  if (!profile) throw new UserError(t.errors.noProfile, 403);
  const fields = await profileFields(supabase, await readJson(req), false);
  if (Object.keys(fields).length === 0) return NextResponse.json({ profile });
  const row = check(await supabase.from("mahdi_profiles").update(fields).eq("user_id", user.id).select("*").single());
  if ("display_name" in fields || "frame" in fields) await syncPublicProfile(user.id);
  return NextResponse.json({ profile: profileFromRow(row as ProfileRow) });
});
