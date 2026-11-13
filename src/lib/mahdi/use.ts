// How the app is used: the section a page belongs to (one row per person, day and section — see migration 0110).

/** The section of a «لأجل المهدي» path: the first part after /mahdi ("home" for the home page), or null outside it. */
export function areaOf(pathname: string): string | null {
  const m = /^\/mahdi(?:\/([^/?#]*))?/.exec(pathname);
  if (!m) return null;
  const first = (m[1] ?? "").toLowerCase();
  if (!first) return "home";
  return /^[a-z0-9-]{1,30}$/.test(first) ? first : null;
}

/** A day as the person's device sees it: YYYY-MM-DD. */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A day sent by a device is accepted when it is at most one day away from the server's own day (time zones). */
export function plausibleDay(day: unknown, now = new Date()): day is string {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (Number.isNaN(t)) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.abs(t - today) <= 86_400_000;
}
