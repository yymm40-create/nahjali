// What the codes a person entered give besides sections (migration 0083) — the parts that need the database: the Claude
// model ceiling, and the number of Seedance 2.0 generations a code allows (JAWAD AI's studio and the film maker count
// together, from the day the person entered the code). Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { claudeIdFor } from "@config/access";
import { perksOf } from "@/lib/access";

export const SEEDANCE_20_GENERATOR = "byteplus-seedance-2-0";

/** The Claude model id to serve this person: their pick, or the ceiling their code sets when the pick is dearer. */
export async function claudeFor(email: string | null | undefined, picked: unknown): Promise<string> {
  return claudeIdFor(picked, await perksOf(email));
}

/** Seedance 2.0 generations this person made since `since` (failed and cancelled ones do not count). */
export async function seedanceUsed(userId: string, since: string): Promise<number> {
  const db = createAdminClient();
  const [studio, projects] = await Promise.all([
    db.from("jawad_jobs").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("generator_id", SEEDANCE_20_GENERATOR).not("status", "in", "(failed,cancelled)").gte("created_at", since),
    db.from("film_projects").select("id").eq("user_id", userId),
  ]);
  const ids = (projects.data ?? []).map((p) => p.id as string);
  let film = 0;
  if (ids.length) {
    const { count } = await db.from("film_assets").select("id", { count: "exact", head: true }).in("project_id", ids).eq("kind", "video").eq("meta->>model", "seedance-2.0").neq("status", "failed").gte("created_at", since);
    film = count ?? 0;
  }
  return (studio.count ?? 0) + film;
}

/** Refuses clearly when the person's code allows no more Seedance 2.0 generations (no ceiling = nothing to check). */
export async function requireSeedanceRoom(user: { id: string; email?: string | null }) {
  const cap = (await perksOf(user.email)).videoGens;
  if (!cap) return;
  const used = await seedanceUsed(user.id, cap.since);
  if (cap.cap === 0) throw new UserError("Seedance 2.0 غير متاح بكودك.", 403);
  if (used >= cap.cap) {
    throw new UserError(`وصلت للحد اللي يسمح به كودك: ${cap.cap === 1 ? "توليد واحد" : cap.cap === 2 ? "توليدان" : `${cap.cap} توليدات`} بـ Seedance 2.0 (استعملت ${used}).`, 403);
  }
}
