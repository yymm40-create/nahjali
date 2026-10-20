// A visitor who has not signed in sees the same public page as every other such visitor, so the CDN may keep it for a few
// seconds and a crowd opening it together is served from there instead of each building the page again. Only these exact
// pages, only plain page loads (no query, no router data requests), and only with no sign-in cookie: whoever is signed in
// (or has a Supabase session cookie at all) is never served a kept copy, and a kept copy never carries a signed-in page.

/** The public pages worth keeping. Exact paths: anything with a form, a query or a person in it stays out. */
export const CDN_PAGES: ReadonlySet<string> = new Set(["/jawad-ai", "/jawad-ai/course", "/jawad-ai/games", "/jawad-ai/login"]);

/** Fresh for 20 s, then served while it is renewed for 40 s more (the owner's change shows within a minute). */
export const CDN_CACHE_CONTROL = "s-maxage=20, stale-while-revalidate=40";

/** The query that gives the signed-out copy its own address (so the CDN never mixes it with a signed-in request's). */
export const CDN_KEY_PARAM = "_a";

/** This project's reference in its Supabase address (https://<ref>.supabase.co). */
export const projectRef = (supabaseUrl: string | undefined) => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).hostname.split(".")[0] : null;
  } catch {
    return null;
  }
};

/** The names of Supabase's sign-in cookie for this project: the cookie itself and its first chunk. */
export const authCookieNames = (ref: string) => [`sb-${ref}-auth-token`, `sb-${ref}-auth-token.0`];

/**
 * Whether one of those cookies is present. next.config.ts decides «no sign-in cookie» with exactly these two names, so the
 * proxy must decide with exactly the same ones: a cookie of another project (or any other name) is neither a session here
 * nor a reason to treat the visit differently.
 */
export const hasAuthCookie = (cookieNames: Iterable<string>, ref: string) => {
  const mine = authCookieNames(ref);
  return [...cookieNames].some((n) => mine.includes(n));
};

export function cdnCacheable(req: { method: string; path: string; search: string; cookieNames: Iterable<string>; ref: string | null; header: (name: string) => string | null }): boolean {
  return (
    // without the project's reference the sign-in cookie can't be told apart: nothing is kept
    req.ref !== null &&
    req.method === "GET" &&
    CDN_PAGES.has(req.path) &&
    req.search === "" &&
    !hasAuthCookie(req.cookieNames, req.ref) &&
    // the client router's data and prefetch requests are not the page (they vary by router state)
    !req.header("rsc") &&
    !req.header("next-router-prefetch") &&
    !req.header("next-router-state-tree") &&
    !req.header("next-router-segment-prefetch")
  );
}
