// SERVER ONLY. «المسابقة»: every read and write of a race goes through here with the service role; the tables are closed to clients.
import { RACE_LIMITS, RACE_MISSIONS, RACE_ROUNDS } from "@config/mahdi-race";
import { dealTeams, pickSpies, raceCode, raceScore, type RaceTeam } from "../race";
import { createAdminClient } from "@/lib/supabase/admin";
import { check, UserError } from "./api";

type Db = ReturnType<typeof createAdminClient>;

export interface RaceRow {
  id: string;
  owner_id: string;
  title: string;
  code: string;
  team_a: string;
  team_b: string;
  emoji_a: string;
  emoji_b: string;
  banned: string;
  current_round: string | null;
  spies_on: boolean;
  revealed: boolean;
  winner: "a" | "b" | "tie" | null;
}

export interface RacePlayerRow {
  user_id: string;
  name: string;
  selfie_v: number;
  team: RaceTeam | null;
  kid: boolean;
  spy: boolean;
  missions: string[];
}

const RACE_COLS = "id, owner_id, title, code, team_a, team_b, emoji_a, emoji_b, banned, current_round, spies_on, revealed, winner";
const PLAYER_COLS = "user_id, name, selfie_v, team, kid, spy, missions";

export function text(v: unknown, max: number, min = 1): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length < min || s.length > max) throw new UserError("النص فاضي أو طويل", 400);
  return s;
}

export const teamOf = (v: unknown): RaceTeam => {
  if (v !== "a" && v !== "b") throw new UserError("فريق غير صحيح", 400);
  return v;
};

export async function raceById(db: Db, id: string): Promise<RaceRow> {
  const { data } = await db.from("mahdi_races").select(RACE_COLS).eq("id", id).maybeSingle();
  if (!data) throw new UserError("المسابقة غير موجودة", 404);
  return data as RaceRow;
}

export async function createRace(db: Db, ownerId: string, title: string): Promise<string> {
  const race = check(await db.from("mahdi_races").insert({ owner_id: ownerId, title, code: raceCode() }).select("id").single()) as { id: string };
  check(
    await db.from("mahdi_race_rounds").insert(
      RACE_ROUNDS.map((r, i) => ({ race_id: race.id, pos: i, name: r.name, icon: r.icon, how: r.how.join("\n"), tools: r.tools, pts: r.pts, water: !!r.water, tool: r.tool ?? "timer", word_set: r.wordSet ?? "", per: r.per ?? 0, secs: r.secs ?? 0 })),
    ),
  );
  return race.id;
}

/** Adds one line to the day's record. A failed line never stops the game. */
export async function logEvent(db: Db, raceId: string, actor: { id: string; name?: string | null } | null, kind: string, data: Record<string, unknown> = {}, clientAt?: unknown) {
  const when = typeof clientAt === "string" && !Number.isNaN(Date.parse(clientAt)) ? new Date(clientAt).toISOString() : null;
  try {
    await db.from("mahdi_race_events").insert({ race_id: raceId, actor: actor?.id ?? null, actor_name: actor?.name ?? null, kind: kind.slice(0, 40), data, client_at: when });
  } catch (err) {
    console.error("[mahdi race log]", err);
  }
}

/** Names what a leader's action touched while it still exists (a deleted round, a removed player, an undone point). */
export async function actionContext(db: Db, raceId: string, b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  if (typeof b.user === "string") out.userName = (await db.from("mahdi_race_players").select("name").eq("race_id", raceId).eq("user_id", b.user).maybeSingle()).data?.name ?? null;
  if (typeof b.round === "string") out.roundName = (await db.from("mahdi_race_rounds").select("name").eq("race_id", raceId).eq("id", b.round).maybeSingle()).data?.name ?? null;
  if (typeof b.point === "string") out.pointWas = (await db.from("mahdi_race_points").select("team, points, reason").eq("race_id", raceId).eq("id", b.point).maybeSingle()).data ?? null;
  return out;
}

/** The whole day for the film: every line in order, with seconds from the first line, and the final state. Leader only. */
export async function raceExport(db: Db, race: RaceRow) {
  const events: { id: number; at: string; client_at: string | null; actor_name: string | null; kind: string; data: unknown }[] = [];
  for (let from = 0; ; from += 1000) {
    const page = (check(await db.from("mahdi_race_events").select("id, at, client_at, actor_name, kind, data").eq("race_id", race.id).order("id").range(from, from + 999)) ?? []) as typeof events;
    events.push(...page);
    if (page.length < 1000) break;
  }
  const t0 = events.length ? Date.parse(events[0].client_at ?? events[0].at) : 0;
  const view = await raceView(db, race, race.owner_id);
  return {
    exportedAt: new Date().toISOString(),
    race: view.race,
    scores: view.scores,
    players: view.players,
    rounds: view.rounds,
    points: view.points,
    events: events.map((e) => ({ ...e, sec: Math.round((Date.parse(e.client_at ?? e.at) - t0) / 100) / 10 })),
  };
}

/** What one person may see. The leader sees everything; a player sees only their own spy role until the reveal. */
export async function raceView(db: Db, race: RaceRow, userId: string) {
  const isOwner = race.owner_id === userId;
  const [players, rounds, points] = await Promise.all([
    db.from("mahdi_race_players").select(PLAYER_COLS).eq("race_id", race.id).order("joined_at"),
    db.from("mahdi_race_rounds").select("id, pos, name, icon, how, tools, pts, water, tool, word_set, per, secs, done").eq("race_id", race.id).order("pos"),
    db.from("mahdi_race_points").select("id, team, points, reason, created_at").eq("race_id", race.id).order("created_at", { ascending: false }).limit(RACE_LIMITS.pointsShown),
  ]);
  const rows = (check(players) ?? []) as RacePlayerRow[];
  const me = rows.find((p) => p.user_id === userId) ?? null;
  if (!isOwner && !me) throw new UserError("ما انضممت لهذي المسابقة", 403);
  const pts = (check(points) ?? []) as { id: string; team: RaceTeam; points: number; reason: string; created_at: string }[];
  const all = check(await db.from("mahdi_race_points").select("team, points").eq("race_id", race.id)) as { team: RaceTeam; points: number }[];
  return {
    race: { id: race.id, title: race.title, code: race.code, teamA: race.team_a, teamB: race.team_b, emojiA: race.emoji_a, emojiB: race.emoji_b, banned: race.banned, currentRound: race.current_round, spiesOn: race.spies_on, revealed: race.revealed, winner: race.winner },
    isOwner,
    scores: raceScore(all ?? []),
    players: rows.map((p) => ({ id: p.user_id, name: p.name, sv: p.selfie_v, team: p.team, kid: p.kid, spy: isOwner || race.revealed ? p.spy : undefined, missions: race.revealed || isOwner ? p.missions : undefined })),
    me: me ? { id: me.user_id, name: me.name, sv: me.selfie_v, team: me.team, spy: race.spies_on && me.spy, missions: race.spies_on && me.spy ? me.missions : [] } : null,
    rounds: check(rounds) ?? [],
    points: pts,
  };
}

async function setTeams(db: Db, raceId: string, map: Record<string, RaceTeam>) {
  await Promise.all(Object.entries(map).map(async ([uid, team]) => check(await db.from("mahdi_race_players").update({ team }).eq("race_id", raceId).eq("user_id", uid))));
}

async function liteOf(db: Db, raceId: string) {
  const rows = (check(await db.from("mahdi_race_players").select("user_id, team, kid").eq("race_id", raceId)) ?? []) as { user_id: string; team: RaceTeam | null; kid: boolean }[];
  return rows.map((p) => ({ id: p.user_id, team: p.team, kid: p.kid }));
}

/** The leader's panel: one action at a time. */
export async function raceAction(db: Db, race: RaceRow, b: Record<string, unknown>) {
  const id = race.id;
  const uid = () => text(b.user, 40);
  switch (b.action) {
    case "settings": {
      const patch: Record<string, string> = {};
      if (b.title !== undefined) patch.title = text(b.title, RACE_LIMITS.title);
      if (b.teamA !== undefined) patch.team_a = text(b.teamA, RACE_LIMITS.team);
      if (b.teamB !== undefined) patch.team_b = text(b.teamB, RACE_LIMITS.team);
      if (b.emojiA !== undefined) patch.emoji_a = text(b.emojiA, 8);
      if (b.emojiB !== undefined) patch.emoji_b = text(b.emojiB, 8);
      if (b.banned !== undefined) patch.banned = text(b.banned, 30, 0);
      check(await db.from("mahdi_races").update(patch).eq("id", id));
      return;
    }
    case "deal":
      await setTeams(db, id, dealTeams(await liteOf(db, id)));
      return;
    case "move":
      check(await db.from("mahdi_race_players").update({ team: b.team === null ? null : teamOf(b.team) }).eq("race_id", id).eq("user_id", uid()));
      return;
    case "kid":
      check(await db.from("mahdi_race_players").update({ kid: !!b.kid }).eq("race_id", id).eq("user_id", uid()));
      return;
    case "rename":
      check(await db.from("mahdi_race_players").update({ name: text(b.name, RACE_LIMITS.name) }).eq("race_id", id).eq("user_id", uid()));
      return;
    case "remove":
      check(await db.from("mahdi_race_players").delete().eq("race_id", id).eq("user_id", uid()));
      return;
    case "spies": {
      const lite = await liteOf(db, id);
      if (lite.some((p) => !p.team)) throw new UserError("وزّع كل اللاعبين على الفريقين أول", 400);
      check(await db.from("mahdi_race_players").update({ spy: false, missions: [] }).eq("race_id", id));
      const spies = pickSpies(lite, RACE_MISSIONS);
      await Promise.all(Object.entries(spies).map(async ([u, missions]) => check(await db.from("mahdi_race_players").update({ spy: true, missions }).eq("race_id", id).eq("user_id", u))));
      check(await db.from("mahdi_races").update({ spies_on: true, revealed: false }).eq("id", id));
      return;
    }
    case "spiesOff":
      check(await db.from("mahdi_race_players").update({ spy: false, missions: [] }).eq("race_id", id));
      check(await db.from("mahdi_races").update({ spies_on: false, revealed: false }).eq("id", id));
      return;
    case "reveal":
      check(await db.from("mahdi_races").update({ revealed: !!b.revealed }).eq("id", id));
      return;
    case "points": {
      const points = Math.trunc(Number(b.points));
      if (!Number.isFinite(points) || !points || Math.abs(points) > RACE_LIMITS.points) throw new UserError("رقم النقاط غير صحيح", 400);
      check(await db.from("mahdi_race_points").insert({ race_id: id, team: teamOf(b.team), points, reason: text(b.reason ?? "", RACE_LIMITS.reason, 0) }));
      return;
    }
    case "undo": {
      const pid = text(b.point, 40);
      check(await db.from("mahdi_race_points").delete().eq("race_id", id).eq("id", pid));
      return;
    }
    case "roundAdd": {
      const count = (await db.from("mahdi_race_rounds").select("id", { count: "exact", head: true }).eq("race_id", id)).count ?? 0;
      if (count >= RACE_LIMITS.rounds) throw new UserError("وصلت أقصى عدد للمسابقات", 400);
      const secs = Math.max(0, Math.min(3600, Math.trunc(Number(b.secs) || 0)));
      check(await db.from("mahdi_race_rounds").insert({ race_id: id, pos: count + 100, name: text(b.name, 60), icon: text(b.icon ?? "🎯", 8), how: text(b.how ?? "", 1500, 0), tools: text(b.tools ?? "", 200, 0), pts: text(b.pts ?? "", 120, 0), water: !!b.water, secs }));
      return;
    }
    case "roundDelete": {
      const rid = text(b.round, 40);
      check(await db.from("mahdi_race_rounds").delete().eq("race_id", id).eq("id", rid));
      if (race.current_round === rid) check(await db.from("mahdi_races").update({ current_round: null }).eq("id", id));
      return;
    }
    case "roundDone":
      check(await db.from("mahdi_race_rounds").update({ done: !!b.done }).eq("race_id", id).eq("id", text(b.round, 40)));
      return;
    case "roundCurrent":
      check(await db.from("mahdi_races").update({ current_round: b.round ? text(b.round, 40) : null }).eq("id", id));
      return;
    case "finish": {
      // The final winner goes up on everyone's screen. On equal points the leader chooses, or calls it a tie.
      const all = (check(await db.from("mahdi_race_points").select("team, points").eq("race_id", id)) ?? []) as { team: RaceTeam; points: number }[];
      const s = raceScore(all);
      const winner = b.winner === "a" || b.winner === "b" || b.winner === "tie" ? b.winner : s.a === s.b ? null : s.a > s.b ? "a" : "b";
      if (!winner) throw new UserError("النقاط متعادلة: اختر الفايز أو أعلن التعادل", 400);
      check(await db.from("mahdi_races").update({ winner }).eq("id", id));
      return;
    }
    case "unfinish":
      check(await db.from("mahdi_races").update({ winner: null }).eq("id", id));
      return;
    case "code":
      check(await db.from("mahdi_races").update({ code: raceCode() }).eq("id", id));
      return;
    default:
      throw new UserError("طلب غير معروف", 400);
  }
}
