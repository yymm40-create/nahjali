// «الجواد في كلاود وشات جي بي تي» · runs one of the site's own route handlers for a connector's tool. Server only.
//
// The tools never copy a section's logic: they call the same handler the person's page calls (inside `actAs`, see
// acting.ts), so the checks, prices, wallet and saved work are exactly the site's.

// (`never`: any route's own params type is accepted; the caller passes the matching values)
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response> | Response;

/** A section's refusal or failure, with the Arabic message its page would show (and the extra fields it sent). */
export class RouteError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function callRoute<T = Record<string, unknown>>(
  handler: Handler,
  o: { origin: string; path: string; method?: "GET" | "POST"; body?: unknown; query?: Record<string, string>; params?: Record<string, string>; signal?: AbortSignal },
): Promise<T> {
  const url = new URL(o.path, o.origin);
  for (const [k, v] of Object.entries(o.query ?? {})) url.searchParams.set(k, v);
  const method = o.method ?? (o.body === undefined ? "GET" : "POST");
  const req = new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(o.body ?? {}) } : {}),
    ...(o.signal ? { signal: o.signal } : {}),
  });
  const res = await handler(req, { params: Promise.resolve(o.params ?? {}) as Promise<never> });
  // a redirect (a download link): its address is the answer
  if (res.status >= 300 && res.status < 400) return { location: res.headers.get("location") } as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new RouteError(typeof data.error === "string" ? data.error : `خطأ ${res.status}`, res.status, data);
  return data as T;
}
