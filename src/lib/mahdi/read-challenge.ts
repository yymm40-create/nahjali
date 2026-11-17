// «تحدي القراءة»: the pure parts (phase, days, ranking), shared by the server, the page and the tests.
import { addDays } from "./engine";

export interface ReadChallenge {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
}
export type ReadPhase = "soon" | "live" | "over";

export interface ReadEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  pages: number;
  days: number;
}
export interface RankedReadEntry extends ReadEntry {
  rank: number;
}

/** Where the challenge stands on a person's own day. */
export function readPhase(c: Pick<ReadChallenge, "startsOn" | "endsOn">, today: string): ReadPhase {
  if (today < c.startsOn) return "soon";
  if (today > c.endsOn) return "over";
  return "live";
}

/** Day n of the challenge (1…length) and how many days it lasts. */
export function readDays(c: Pick<ReadChallenge, "startsOn" | "endsOn">, today: string) {
  let length = 1;
  while (addDays(c.startsOn, length) <= c.endsOn) length++;
  let day = 0;
  while (day < length && addDays(c.startsOn, day) <= today) day++;
  return { day, length, left: Math.max(0, length - day) };
}

/** Most pages first; more reading days breaks a tie in order but equal pages share a rank (1, 1, 3). */
export function rankReaders(entries: ReadEntry[]): RankedReadEntry[] {
  const sorted = [...entries].sort((a, b) => b.pages - a.pages || b.days - a.days || a.displayName.localeCompare(b.displayName, "ar") || a.userId.localeCompare(b.userId));
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || e.pages !== sorted[i - 1].pages) rank = i + 1;
    return { ...e, rank };
  });
}
