// SERVER ONLY. «تحدي القراءة»: the current challenge, joining (with consent) and the list everyone sees.
// The tables are closed to clients; everything goes through here with the service role.
import { createAdminClient } from "@/lib/supabase/admin";
import { rankReaders, type RankedReadEntry, type ReadChallenge, type ReadEntry } from "../read-challenge";
import { check } from "./api";
import { peopleInfo } from "./groups";

/** Postgres «relation does not exist» / «function does not exist»: the SQL file has not been run yet. */
const notReady = (e: unknown) => ["42P01", "42883", "PGRST202", "PGRST205"].includes((e as { code?: string })?.code ?? "");

/** The latest challenge that has started or starts tomorrow at the latest (null before the SQL is run, or when none). */
export async function currentReadChallenge(today: string): Promise<ReadChallenge | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("mahdi_read_challenges").select("id, title, starts_on, ends_on").lte("starts_on", today).order("starts_on", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (notReady(error)) return null;
    throw error;
  }
  return data ? { id: data.id, title: data.title, startsOn: data.starts_on, endsOn: data.ends_on } : null;
}

export async function isReadMember(challengeId: string, userId: string): Promise<boolean> {
  const { data } = await createAdminClient().from("mahdi_read_challenge_members").select("user_id").eq("challenge_id", challengeId).eq("user_id", userId).maybeSingle();
  return Boolean(data);
}

export async function joinReadChallenge(challengeId: string, userId: string) {
  check(await createAdminClient().from("mahdi_read_challenge_members").upsert({ challenge_id: challengeId, user_id: userId }, { onConflict: "challenge_id,user_id", ignoreDuplicates: true }));
  boardCache.delete(challengeId);
}

const boardCache = new Map<string, { at: number; entries: RankedReadEntry[] }>();
const TTL = 60_000;

/** Everyone who joined, with their pages, ranked. Cached for a minute per server instance. */
export async function readChallengeBoard(challengeId: string): Promise<RankedReadEntry[]> {
  const hit = boardCache.get(challengeId);
  if (hit && Date.now() - hit.at < TTL) return hit.entries;
  const db = createAdminClient();
  const rows = (check(await db.rpc("mahdi_read_challenge_pages", { p_challenge: challengeId })) ?? []) as { user_id: string; pages: number; days: number }[];
  const people = await peopleInfo(db, rows.map((r) => r.user_id));
  const entries: ReadEntry[] = rows
    .filter((r) => people.has(r.user_id))
    .map((r) => ({ userId: r.user_id, displayName: people.get(r.user_id)!.displayName, avatarUrl: people.get(r.user_id)!.avatarUrl, pages: Number(r.pages), days: Number(r.days) }));
  const ranked = rankReaders(entries);
  boardCache.set(challengeId, { at: Date.now(), entries: ranked });
  return ranked;
}
