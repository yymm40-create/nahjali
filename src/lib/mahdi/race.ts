// «المسابقة»: the race's pure rules (no database): balanced teams, one spy per team, the score, the final.
export type RaceTeam = "a" | "b";

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

/** Deals everyone to two teams of equal size (at most one apart), the kids shared out evenly first. */
export function dealTeams(players: readonly RacePlayerLite[], rand: Rand = Math.random): Record<string, RaceTeam> {
  const out: Record<string, RaceTeam> = {};
  const size = { a: 0, b: 0 };
  const groups = [players.filter((p) => p.kid), players.filter((p) => !p.kid)];
  for (const g of groups)
    for (const p of shuffled(g, rand)) {
      const to: RaceTeam = size.a === size.b ? (rand() < 0.5 ? "a" : "b") : size.a < size.b ? "a" : "b";
      out[p.id] = to;
      size[to]++;
    }
  return out;
}

/** One spy for each team, never a kid; each spy gets `perSpy` different missions. */
export function pickSpies(players: readonly RacePlayerLite[], missions: readonly string[], perSpy = 2, rand: Rand = Math.random): Record<string, string[]> {
  const pool = shuffled(missions, rand);
  const out: Record<string, string[]> = {};
  for (const team of ["a", "b"] as const) {
    const can = players.filter((p) => p.team === team && !p.kid);
    if (!can.length) continue;
    out[can[Math.floor(rand() * can.length)].id] = pool.splice(0, perSpy);
  }
  return out;
}

export function raceScore(points: readonly { team: RaceTeam; points: number }[]): Record<RaceTeam, number> {
  const s = { a: 0, b: 0 };
  for (const p of points) s[p.team] += p.points;
  return s;
}

/** The final's points: 15 for each player left, 30 more for the team with more left. */
export function finalPoints(leftA: number, leftB: number): { team: RaceTeam; points: number; reason: string }[] {
  const out: { team: RaceTeam; points: number; reason: string }[] = [];
  if (leftA > 0) out.push({ team: "a", points: leftA * 15, reason: `النهائي: بقى ${leftA}` });
  if (leftB > 0) out.push({ team: "b", points: leftB * 15, reason: `النهائي: بقى ${leftB}` });
  if (leftA > leftB) out.push({ team: "a", points: 30, reason: "آخر فريق واقف" });
  if (leftB > leftA) out.push({ team: "b", points: 30, reason: "آخر فريق واقف" });
  return out;
}

const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** A join code that is easy to read out (no 0/O, 1/I/L). */
export function raceCode(rand: Rand = Math.random, len = 6): string {
  let s = "";
  for (let i = 0; i < len; i++) s += CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)];
  return s;
}
