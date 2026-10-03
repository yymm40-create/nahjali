import { NextResponse } from "next/server";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { MILESTONES } from "@config/mahdi-rewards";
import { buildTimeline, milestoneMetrics } from "@/lib/mahdi/engine";
import { challengeHabits, toItems } from "@/lib/mahdi/client/derive";
import { mahdiRoute, readJson, requireProfile } from "@/lib/mahdi/server/api";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Re-computes the milestones from the user's own data and unlocks the new ones.
 * The browser can't unlock anything by itself (no write access to mahdi_user_rewards).
 */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const snap = await loadSnapshot(supabase, profile);
  const items = toItems([...snap.habits, ...challengeHabits(snap)], snap.logs);
  const tl = buildTimeline(items, snap.logsFrom, snap.today, { asOf: snap.today, weekStart: profile.weekStart });
  const metrics = milestoneMetrics(tl, CONSISTENCY_THRESHOLD);
  const have = new Set(snap.rewards.map((r) => r.milestoneId));
  const fresh = MILESTONES.filter((m) => !have.has(m.id) && metrics[m.metric] >= m.threshold).map((m) => m.id);
  if (fresh.length) {
    const { error } = await createAdminClient()
      .from("mahdi_user_rewards")
      .upsert(fresh.map((id) => ({ user_id: user.id, milestone_id: id })), { onConflict: "user_id,milestone_id", ignoreDuplicates: true });
    if (error) throw error;
  }
  const { data } = await supabase.from("mahdi_user_rewards").select("milestone_id, unlocked_at, seen_at");
  return NextResponse.json({
    metrics,
    fresh,
    rewards: (data ?? []).map((r) => ({ milestoneId: r.milestone_id, unlockedAt: r.unlocked_at, seenAt: r.seen_at })),
  });
});

/** Marks rewards as seen (so the reveal shows once). */
export const PATCH = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const { ids } = await readJson(req);
  const list = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, 50) : [];
  if (list.length) await supabase.from("mahdi_user_rewards").update({ seen_at: new Date().toISOString() }).in("milestone_id", list).is("seen_at", null);
  return NextResponse.json({ ok: true });
});
