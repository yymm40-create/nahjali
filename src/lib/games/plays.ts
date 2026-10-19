// «صانع الألعاب الذكي» · the game's counter on the server: a sitting opened and kept going while the game is on screen,
// and the numbers its owner (and the site's owner) see. The owner's own plays are not counted.

import { createAdminClient } from "@/lib/supabase/admin";
import { PLAYS, statsOf, type Device, type GameStats, type PlayRow } from "./plays-shared";

const db = () => createAdminClient();
const T = "game_plays";
const UUID = /^[0-9a-f-]{36}$/i;
const VISITOR = /^[A-Za-z0-9_-]{8,64}$/;

/** The table is not there yet (0082 not run): the counter stays quiet instead of failing the game. */
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /game_plays/.test(e.message ?? ""));

export interface Beat {
  visitor: string;
  session?: string | null;
  add?: number;
  source?: string;
  device?: Device;
}

/**
 * A heartbeat from a player's browser: opens a sitting (or goes on with the one it had, or its last one if it was a
 * moment ago) and adds the seconds since the last beat. Returns the sitting's id, or null when nothing is counted.
 */
export async function beat(gameId: string, b: Beat, userId: string | null): Promise<string | null> {
  if (!UUID.test(gameId) || !VISITOR.test(b.visitor ?? "")) return null;
  const add = Math.max(0, Math.min(PLAYS.maxAdd, Math.round(Number(b.add) || 0)));
  const now = new Date();
  const fresh = new Date(now.getTime() - PLAYS.resumeMs).toISOString();
  const { data: game } = await db().from("games_builds").select("user_id,version").eq("id", gameId).maybeSingle();
  if (!game || !game.version) return null;
  if (userId && game.user_id === userId) return null;

  const goOn = async (q: { id: string; seconds: number }) => {
    const { error } = await db().from(T).update({ seconds: Math.min(PLAYS.maxSeconds, q.seconds + add), last_seen_at: now.toISOString(), ...(userId ? { user_id: userId } : {}) }).eq("id", q.id);
    return error ? null : q.id;
  };
  if (b.session && UUID.test(b.session)) {
    const { data, error } = await db().from(T).select("id,seconds").eq("id", b.session).eq("game_id", gameId).eq("visitor", b.visitor).gte("last_seen_at", fresh).maybeSingle();
    if (missing(error)) return null;
    if (data) return goOn(data as { id: string; seconds: number });
  }
  const { data: recent, error } = await db().from(T).select("id,seconds").eq("game_id", gameId).eq("visitor", b.visitor).gte("last_seen_at", fresh).order("last_seen_at", { ascending: false }).limit(1).maybeSingle();
  if (missing(error)) return null;
  if (recent) return goOn(recent as { id: string; seconds: number });
  const { data: row, error: e2 } = await db()
    .from(T)
    .insert({ game_id: gameId, visitor: b.visitor, user_id: userId, source: String(b.source ?? "").slice(0, 40), device: b.device ?? "", seconds: add })
    .select("id")
    .single();
  return e2 ? null : (row.id as string);
}

/** The game's owner, to let only them (and the site's owner) see its numbers. */
export async function gameOwner(gameId: string): Promise<string | null> {
  if (!UUID.test(gameId)) return null;
  const { data } = await db().from("games_builds").select("user_id").eq("id", gameId).maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function rowsOf(gameId: string): Promise<PlayRow[]> {
  const out: PlayRow[] = [];
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await db().from(T).select("visitor,user_id,source,device,seconds,started_at").eq("game_id", gameId).order("started_at", { ascending: false }).range(from, from + 999);
    if (error || !data?.length) break;
    out.push(...(data as PlayRow[]));
    if (data.length < 1000) break;
  }
  return out;
}

export async function gameStats(gameId: string): Promise<GameStats> {
  return statsOf(await rowsOf(gameId));
}

export interface GameStatsRow {
  id: string;
  title: string;
  owner: string;
  opens: number;
  players: number;
  minutes: number;
  lastPlayed: string | null;
}

/** Every game with its numbers, the most played first (the site's owner, /admin/games). */
export async function allGamesStats(): Promise<{ ready: boolean; games: GameStatsRow[] }> {
  const rows: (PlayRow & { game_id: string })[] = [];
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await db().from(T).select("game_id,visitor,user_id,source,device,seconds,started_at").order("started_at", { ascending: false }).range(from, from + 999);
    if (missing(error)) return { ready: false, games: [] };
    if (error || !data?.length) break;
    rows.push(...(data as (PlayRow & { game_id: string })[]));
    if (data.length < 1000) break;
  }
  const by = new Map<string, PlayRow[]>();
  for (const r of rows) {
    const list = by.get(r.game_id);
    if (list) list.push(r);
    else by.set(r.game_id, [r]);
  }
  if (!by.size) return { ready: true, games: [] };
  const { data: games } = await db().from("games_builds").select("id,title,user_id").in("id", [...by.keys()]);
  const owners = new Map<string, string>();
  for (const uid of new Set((games ?? []).map((g) => g.user_id as string))) {
    const { data } = await db().auth.admin.getUserById(uid);
    owners.set(uid, data.user?.email ?? "");
  }
  return {
    ready: true,
    games: (games ?? [])
      .map((g) => {
        const s = statsOf(by.get(g.id as string) ?? []);
        return { id: g.id as string, title: String(g.title ?? ""), owner: owners.get(g.user_id as string) ?? "", opens: s.opens, players: s.players, minutes: s.minutes, lastPlayed: s.lastPlayed };
      })
      .sort((a, b) => b.opens - a.opens),
  };
}
