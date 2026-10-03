// Browser → «لأجل المهدي» API. Errors carry the Arabic message from the server.
import { t } from "../i18n";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function mahdiFetch<T = unknown>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(url, {
      cache: "no-store",
      ...rest,
      headers: json !== undefined ? { "Content-Type": "application/json", ...rest.headers } : rest.headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(t.errors.network, 0);
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) {
    // Session ended (signed out elsewhere or expired): back to the sign-in page, then here again
    const next = encodeURIComponent(location.pathname + location.search);
    // A full reload on purpose: it drops the stale session from memory
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    location.href = `/mahdi/login?next=${next}`;
    throw new ApiError(t.errors.unauthenticated, 401);
  }
  if (!res.ok) throw new ApiError((body as { error?: string }).error ?? t.errors.generic, res.status);
  return body as T;
}
