// «الذكاء الإسلامي» — a reader of one source. Each reads in steps (a request is short): given where it stopped and
// a deadline, it returns the documents it read, where to continue, and whether it reached the end.

export interface ReadDoc {
  url: string;
  kind: string;
  title: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface ReadStep {
  docs: ReadDoc[];
  cursor: Record<string, unknown>;
  done: boolean;
  /** what the reader is on, for the dashboard */
  stage: string;
}

export interface Reader {
  step(source: { url: string }, cursor: Record<string, unknown>, deadline: number): Promise<ReadStep>;
}

export const UA = "JawadAI-IslamicLibrary/1.0 (+https://nahjali.com)";

/** GET with a timeout; the body as text, or null when the site refused or failed. */
export async function get(url: string, accept = "text/html,application/json"): Promise<string | null> {
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, accept, "accept-language": "ar" }, signal: AbortSignal.timeout(30_000), redirect: "follow" });
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

export async function getJson<T>(url: string): Promise<T | null> {
  const t = await get(url, "application/json");
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

/** Runs `fn` over the items a few at a time (polite to the site), keeping the order. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

/** Items of a sitemap (URLs in <loc>). */
export const sitemapUrls = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
