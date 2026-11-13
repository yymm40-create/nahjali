// «انصنع في الجواد»: how many pictures and videos people really made on the platform in the last 30 days — the studio's
// generations and the film maker's videos and sheet pictures that SUCCEEDED (marketing psychology, 14 November 2026: real
// social proof only, never an invented number). Rounded DOWN to a round figure, and not shown below a floor. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { ttlCache } from "@/lib/ttl-cache";

/** Below this, no number is shown at all (a small number is not proof of anything). */
export const PROOF_FLOOR = 100;

/** «+650»: rounded down to the 50 (to the 100 from 1,000), so it never says more than happened. */
export const roundedDown = (n: number) => (n >= 1000 ? Math.floor(n / 100) * 100 : Math.floor(n / 50) * 50);

const made = ttlCache(60 * 60_000, async (): Promise<number> => {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [studio, film] = await Promise.all([
    db.from("jawad_jobs").select("id", { count: "exact", head: true }).eq("status", "succeeded").gte("created_at", since),
    db.from("film_jobs").select("id", { count: "exact", head: true }).eq("status", "succeeded").in("operation", ["director_video", "sheet_image"]).gte("created_at", since),
  ]);
  return (studio.count ?? 0) + (film.count ?? 0);
});

/** The rounded count for the pages, or null when it can't be read or is below the floor. */
export async function madeLast30Days(): Promise<number | null> {
  const n = await made().catch(() => 0);
  return n >= PROOF_FLOOR ? roundedDown(n) : null;
}
