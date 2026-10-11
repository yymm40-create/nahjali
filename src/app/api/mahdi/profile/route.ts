import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIGHT_THEMES, MAHDI_LIMITS, type MahdiTheme } from "@config/mahdi";
import { MILESTONES } from "@config/mahdi-rewards";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireUser, UserError } from "@/lib/mahdi/server/api";
import { profileFromRow, type ProfileRow } from "@/lib/mahdi/server/rows";
import { getShrines } from "@/lib/mahdi/server/snapshot";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { parseWidgets } from "@/lib/mahdi/home-widgets";
import { readPlace } from "@/lib/mahdi/shrine-art";
import { createAdminClient } from "@/lib/supabase/admin";
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
  // the home screen the person arranged (the widgets, in order)
  if ("homeWidgets" in body) out.home_widgets = parseWidgets(body.homeWidgets);
  // where the drawn shrine shows (the person's choice over the design's)
  if ("shrinePlace" in body) out.shrine_place = readPlace(body.shrinePlace);
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

/**
 * Until migrations 0062 and 0063 run, the database knows only the older looks and has no home layout: a new look is saved as
 * the nearest older one and the layout is left out, instead of failing the whole save.
 */
async function beforeMigration<R extends { error: { code?: string } | null }>(write: (f: Record<string, unknown>) => PromiseLike<R>, fields: Record<string, unknown>): Promise<R> {
  const first = await write(fields);
  const code = first.error?.code;
  if (code !== "23514" && code !== "42703" && code !== "PGRST204") return first;
  // a design the database doesn't know yet (migrations 0062 / 0063): the older light or dark look, by its colours
  const older = (k: string) => (k === "cinematic" || k === "minimal" || k === "night" ? k : LIGHT_THEMES.includes(k as MahdiTheme) ? "minimal" : "night");
  const { home_widgets: _drop, shrine_place: _place, ...rest } = fields;
  void _drop;
  void _place;
  if (typeof rest.theme === "string") rest.theme = older(rest.theme);
  return write(rest);
}

/** Onboarding: creates the user's «لأجل المهدي» profile (name, shrine, look, time zone). */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireUser(req);
  const fields = await profileFields(supabase, await readJson(req), true);
  // written with the server's own key: the earned columns (frame, variant, view) are checked above and are not
  // writable with a person's key (supabase/migrations/0029)
  const admin = createAdminClient();
  const write = (f: Record<string, unknown>) =>
    (profile ? admin.from("mahdi_profiles").update(f).eq("user_id", user.id) : admin.from("mahdi_profiles").insert({ user_id: user.id, ...f })).select("*").single();
  const row = check(await beforeMigration(write, fields));
  return NextResponse.json({ profile: profileFromRow(row as ProfileRow) });
});

/** Changes some of the profile settings. */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireUser(req);
  if (!profile) throw new UserError(t.errors.noProfile, 403);
  const fields = await profileFields(supabase, await readJson(req), false);
  if (Object.keys(fields).length === 0) return NextResponse.json({ profile });
  const admin = createAdminClient();
  const row = check(await beforeMigration((f) => admin.from("mahdi_profiles").update(f).eq("user_id", user.id).select("*").single(), fields));
  if ("display_name" in fields || "frame" in fields) await syncPublicProfile(user.id);
  return NextResponse.json({ profile: profileFromRow(row as ProfileRow) });
});
