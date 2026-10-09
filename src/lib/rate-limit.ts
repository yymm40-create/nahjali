// How many requests one address may send: a first wall against floods, password-guessing of the secret codes, and
// someone spending the site's paid services in a loop. Counted in the memory of each server instance (no database
// round-trip on every request), so it is a guard, not an exact count; Vercel's own firewall can add a global one.

export interface Rule {
  /** a name for the bucket (one count per rule and address) */
  key: string;
  max: number;
  windowMs: number;
}

/** The rules a request falls under, strictest first; none for what must never be limited (the timers, the webhooks). */
export function rulesFor(path: string, method: string): Rule[] {
  if (!path.startsWith("/api/")) return [];
  // the scheduled jobs and the notification dispatcher are called by Vercel and carry their own secret
  if (path.startsWith("/api/cron/") || path === "/api/islamic/cron" || path === "/api/mahdi/notifications/dispatch") return [];
  const out: Rule[] = [];
  // the secret codes: a few tries, then a pause (guessing a code takes millions)
  if (path === "/api/access/code" && method === "POST") out.push({ key: "code", max: 8, windowMs: 10 * 60_000 });
  // what costs money (Claude, pictures, videos, voices): plenty for a person, a wall for a script
  const paid = ["/api/film/", "/api/jawad/", "/api/games/", "/api/islamic/ask", "/api/content/", "/api/mahdi/assistant", "/api/orders"];
  // (a big video goes up in parts, each signed by the editor's project route: a fast line asks for several a second)
  const parts = path.startsWith("/api/jawad/editor/projects/");
  if (method !== "GET" && !parts && paid.some((p) => path.startsWith(p))) out.push({ key: "paid", max: 90, windowMs: 60_000 });
  // everything else (the pages' polling and the parts of a big upload included)
  out.push({ key: "api", max: 900, windowMs: 60_000 });
  return out;
}

type Hit = { count: number; reset: number };
const hits = new Map<string, Hit>();

/** Counts one request; returns the seconds to wait when a rule is over its limit, else 0. */
export function take(ip: string, rules: Rule[], now = Date.now()): number {
  if (hits.size > 50_000) for (const [k, h] of hits) if (h.reset <= now) hits.delete(k);
  let wait = 0;
  for (const r of rules) {
    const k = `${r.key}:${ip}`;
    let h = hits.get(k);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + r.windowMs };
      hits.set(k, h);
    }
    h.count++;
    if (h.count > r.max) wait = Math.max(wait, Math.ceil((h.reset - now) / 1000));
  }
  return wait;
}

/** The caller's address as Vercel reports it. */
export const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";

/** For the tests: forget every count. */
export const resetLimits = () => hits.clear();
