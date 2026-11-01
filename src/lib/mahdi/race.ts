// «المسابقة»: the race's pure rules (no database): balanced teams, one spy per team, the score, the final.
export type RaceTeam = string;

export interface RaceTeamInfo {
  id: RaceTeam;
  name: string;
  emoji: string;
  color: string;
}

export interface RacePlayerLite {
  id: string;
  team: RaceTeam | null;
  kid: boolean;
}

type Rand = () => number;

export function shuffled<T>(items: readonly T[], rand: Rand = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deals everyone to the teams at even sizes (at most one apart), the kids shared out evenly first. */
export function dealTeams(players: readonly RacePlayerLite[], teams: readonly RaceTeam[], rand: Rand = Math.random): Record<string, RaceTeam> {
  const out: Record<string, RaceTeam> = {};
  const size: Record<RaceTeam, number> = Object.fromEntries(teams.map((t) => [t, 0]));
  for (const g of [players.filter((p) => p.kid), players.filter((p) => !p.kid)])
    for (const p of shuffled(g, rand)) {
      const least = Math.min(...teams.map((t) => size[t]));
      const open = teams.filter((t) => size[t] === least);
      const to = open[Math.floor(rand() * open.length)];
      out[p.id] = to;
      size[to]++;
    }
  return out;
}

/** One spy for each team, never a kid; each spy gets `perSpy` different missions (the list repeats only if it runs out). */
export function pickSpies(players: readonly RacePlayerLite[], missions: readonly string[], teams: readonly RaceTeam[], perSpy = 2, rand: Rand = Math.random): Record<string, string[]> {
  let pool: string[] = shuffled(missions, rand);
  const out: Record<string, string[]> = {};
  for (const team of teams) {
    const can = players.filter((p) => p.team === team && !p.kid);
    if (!can.length) continue;
    if (pool.length < perSpy) pool = shuffled(missions, rand);
    out[can[Math.floor(rand() * can.length)].id] = pool.splice(0, perSpy);
  }
  return out;
}

export function raceScore(points: readonly { team: RaceTeam; points: number }[], teams: readonly RaceTeam[]): Record<RaceTeam, number> {
  const s: Record<RaceTeam, number> = Object.fromEntries(teams.map((t) => [t, 0]));
  for (const p of points) if (p.team in s) s[p.team] += p.points;
  return s;
}

/** The team alone at the top, or null when teams share the top score. */
export function leaderOf(scores: Record<RaceTeam, number>): RaceTeam | null {
  const top = Math.max(...Object.values(scores));
  const first = Object.keys(scores).filter((t) => scores[t] === top);
  return first.length === 1 ? first[0] : null;
}

/** The final's points: 15 for each player left, 30 more for the one team with the most left. */
export function finalPoints(left: Record<RaceTeam, number>): { team: RaceTeam; points: number; reason: string }[] {
  const out: { team: RaceTeam; points: number; reason: string }[] = [];
  for (const [team, n] of Object.entries(left)) if (n > 0) out.push({ team, points: n * 15, reason: `الحسم: بقى ${n}` });
  const lead = leaderOf(left);
  if (lead && left[lead] > 0) out.push({ team: lead, points: 30, reason: "آخر فريق واقف" });
  return out;
}

/** Dark or light text, whichever reads on this team colour. */
export function inkOn(color: string): string {
  const n = parseInt(color.replace("#", ""), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.58 ? "#141414" : "#FFFFFF";
}

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** A join code that is easy to read out (no 0/O, 1/I/L). */
export function raceCode(rand: Rand = Math.random, len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)];
  return s;
}
