// SERVER ONLY. The server's half of the ads work: the auth routes mark a brand-new account for the pixels, and the order
// route reads the visitor's ad cookies to keep on the order (for the Meta Conversions API, src/lib/meta-capi.ts).

import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { NEW_SIGNUP_COOKIE, SOURCE_COOKIE } from "@/lib/track";

/** An account made in the last 15 minutes is signing in for the first time (the same reading as usernameGate). */
export const isFreshAccount = (user: User | null | undefined, now = Date.now()) => !!user && now - new Date(user.created_at).getTime() < 15 * 60_000;

/**
 * A 10-minute cookie the browser can read (Pixels.tsx fires CompleteRegistration once and clears it). Set on the redirect
 * after the sign-in, so it survives the username page a new account passes through; no page or layout has to know.
 */
export function markFreshSignup<R extends NextResponse>(res: R, user: User | null | undefined, secure: boolean): R {
  if (isFreshAccount(user)) res.cookies.set(NEW_SIGNUP_COOKIE, "1", { path: "/", maxAge: 600, sameSite: "lax", secure, httpOnly: false });
  return res;
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    const v = part.slice(i + 1).trim();
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

export interface AdContext {
  /** Meta's browser cookies (set by the pixel when it is on) */
  fbp: string | null;
  fbc: string | null;
  ip: string | null;
  ua: string | null;
  /** the jw_src cookie as sent (used when the page did not send the source itself) */
  source: unknown;
}

/** What the request itself says about the visitor's ads: Meta's _fbp/_fbc, the address and browser, the source cookie. */
export function adContext(req: Request): AdContext {
  const c = parseCookies(req.headers.get("cookie"));
  let source: unknown = null;
  try {
    source = c[SOURCE_COOKIE] ? JSON.parse(c[SOURCE_COOKIE]) : null;
  } catch {
    source = null;
  }
  let fbc = c._fbc ?? null;
  // no _fbc cookie (the pixel off, or blocked) but the ad's click id was captured: Meta's documented shape for it
  const fbclid = source && typeof source === "object" ? (source as Record<string, unknown>).fbclid : null;
  if (!fbc && typeof fbclid === "string" && /^[\w-]{1,100}$/.test(fbclid)) fbc = `fb.1.${Date.now()}.${fbclid}`;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || null;
  return { fbp: c._fbp ?? null, fbc, ip, ua: req.headers.get("user-agent"), source };
}
