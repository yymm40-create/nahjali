// «استخدام المزايا» (the owner's /admin/use): each feature of the studio and «حيدرة كت» with its uses and the people who
// used it in the last 7 and 30 days, and the funnels — how many people reached each step. Read straight from the table
// (0110, run by hand: until then `ready` is false). Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURES, FUNNELS, USE_SECTIONS, dayOf, type FeatureId, type UseSection } from "@config/feature-use";

export type UseRange = "7d" | "30d";
export const USE_RANGES: { id: UseRange; label: string; days: number }[] = [
  { id: "7d", label: "آخر ٧ أيام", days: 7 },
  { id: "30d", label: "آخر ٣٠ يوم", days: 30 },
];

export interface FeatureRow {
  id: FeatureId;
  label: string;
  uses: Record<UseRange, number>;
  people: Record<UseRange, number>;
}
export interface FeatureUse {
  ready: boolean;
  sections: {
    id: UseSection;
    label: string;
    /** every feature of the section, the most used first (in the range asked) */
    rows: FeatureRow[];
    funnel: { label: string; people: number }[];
  }[];
}

const PAGE = 1000;
// the table is not there yet (or its function): the page says so instead of failing
const missing = (e: unknown) => ["42P01", "PGRST205", "PGRST202", "42883"].includes((e as { code?: string } | null)?.code ?? "");

/** The first day of a range (today counted), Saudi time. */
const firstDay = (days: number, now = Date.now()) => dayOf(now - (days - 1) * 86400_000);

export async function loadFeatureUse(sortBy: UseRange): Promise<FeatureUse> {
  const db = createAdminClient();
  const from30 = firstDay(30);
  const from7 = firstDay(7);
  const rows: { day: string; user_id: string; feature: string; uses: number }[] = [];
  for (let from = 0; from < 200_000; from += PAGE) {
    const { data, error } = await db.from("jawad_feature_use").select("day,user_id,feature,uses").gte("day", from30).order("day", { ascending: false }).range(from, from + PAGE - 1);
    if (error) {
      if (missing(error)) return { ready: false, sections: [] };
      throw error;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  // each feature: its uses and its people, in each range
  const tally = new Map<string, { uses: Record<UseRange, number>; who: Record<UseRange, Set<string>> }>();
  for (const r of rows) {
    const t = tally.get(r.feature) ?? { uses: { "7d": 0, "30d": 0 }, who: { "7d": new Set<string>(), "30d": new Set<string>() } };
    t.uses["30d"] += r.uses;
    t.who["30d"].add(r.user_id);
    if (r.day >= from7) {
      t.uses["7d"] += r.uses;
      t.who["7d"].add(r.user_id);
    }
    tally.set(r.feature, t);
  }
  const who = (ids: FeatureId[]) => new Set(ids.flatMap((id) => [...(tally.get(id)?.who[sortBy] ?? [])])).size;

  return {
    ready: true,
    sections: USE_SECTIONS.map((s) => ({
      ...s,
      rows: FEATURES.filter((f) => f.section === s.id)
        .map((f) => {
          const t = tally.get(f.id);
          return { id: f.id, label: f.label, uses: t?.uses ?? { "7d": 0, "30d": 0 }, people: { "7d": t?.who["7d"].size ?? 0, "30d": t?.who["30d"].size ?? 0 } };
        })
        .sort((a, b) => b.uses[sortBy] - a.uses[sortBy] || b.people[sortBy] - a.people[sortBy]),
      funnel: FUNNELS[s.id].map((step) => ({ label: step.label, people: who(step.any) })),
    })),
  };
}
