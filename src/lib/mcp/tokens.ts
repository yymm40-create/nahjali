// «الجواد في كلاود وشات جي بي تي» · the connector's OAuth: signed tokens, no table. Server only.
//
// Claude and ChatGPT add a connector by its address, register themselves (dynamic client registration), send the person
// to our consent page, then trade the code for tokens (OAuth 2.1 with PKCE, as the MCP authorization spec asks). Every
// one of those values is a small signed note (HMAC-SHA256 with a key derived from a server secret), so nothing new is
// stored: a client id carries its own redirect addresses, a code carries the person and the PKCE challenge, a token
// carries the person and when it ends. «افصل الربط» on /jawad-ai/connect stamps the person's account
// (app_metadata.mcp_revoked_at): every token made before that stamp stops working.

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ACCESS_TTL_S = 60 * 60; // an hour; the client refreshes it by itself
export const REFRESH_TTL_S = 90 * 24 * 60 * 60; // 90 days of not using it, then the person links again
export const CODE_TTL_S = 5 * 60;
export const REQUEST_TTL_S = 30 * 60; // the consent page (a sign-in on the way included)

/** Where a client may send the person back: Claude, ChatGPT, and a program on the person's own computer (Claude Code). */
const HOSTS = ["claude.ai", "claude.com", "chatgpt.com", "chat.openai.com"];
export function redirectAllowed(uri: string): boolean {
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.hash || u.username || u.password) return false;
  if (u.protocol === "https:") return HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`));
  return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]");
}

type Kind = "client" | "req" | "code" | "access" | "refresh";
const PREFIX: Record<Kind, string> = { client: "jmc_", req: "jmq_", code: "jmk_", access: "jma_", refresh: "jmr_" };

let cachedKey: Buffer | null = null;
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.MCP_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("no MCP signing secret");
  cachedKey = createHmac("sha256", secret).update("jawad-mcp-oauth-v1").digest();
  return cachedKey;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const mac = (body: string) => createHmac("sha256", key()).update(body).digest();

/** A signed note of `kind` (with `iat`, and `exp` when `ttl` is given). */
export function sign(kind: Kind, payload: Record<string, unknown>, ttl?: number): string {
  const now = Math.floor(Date.now() / 1000);
  const body = b64(JSON.stringify({ ...payload, k: kind, iat: now, ...(ttl ? { exp: now + ttl } : {}), n: randomBytes(6).toString("base64url") }));
  return `${PREFIX[kind]}${body}.${b64(mac(`${kind}.${body}`))}`;
}

/** The note's payload when it is genuine, of `kind`, and not expired; else null. */
export function verify<T extends Record<string, unknown>>(kind: Kind, token: unknown): (T & { iat: number; exp?: number }) | null {
  if (typeof token !== "string" || !token.startsWith(PREFIX[kind]) || token.length > 6000) return null;
  const [body, sig] = token.slice(PREFIX[kind].length).split(".");
  if (!body || !sig) return null;
  const want = mac(`${kind}.${body}`);
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  let p: Record<string, unknown>;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (p.k !== kind || typeof p.iat !== "number") return null;
  if (typeof p.exp === "number" && p.exp < Math.floor(Date.now() / 1000)) return null;
  return p as T & { iat: number; exp?: number };
}

/** A short fingerprint of a client id (codes and tokens carry this, not the whole id). */
export const clientMark = (clientId: string) => createHash("sha256").update(clientId).digest("base64url").slice(0, 22);

/** PKCE S256: does this verifier answer this challenge? */
export function pkceOk(verifier: unknown, challenge: unknown): boolean {
  if (typeof verifier !== "string" || typeof challenge !== "string") return false;
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const want = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const got = Buffer.from(challenge);
  return want.length === got.length && timingSafeEqual(want, got);
}

export interface ClientNote {
  name: string;
  uris: string[];
}
export interface RequestNote {
  cid: string;
  name: string;
  uri: string;
  cc: string;
  st: string | null;
}
export interface CodeNote {
  uid: string;
  cm: string;
  uri: string;
  cc: string;
}
export interface TokenNote {
  uid: string;
  cm: string;
}

/** A token pair for the person (a refresh token goes on working for REFRESH_TTL_S from its last use). */
export function tokenPair(uid: string, cm: string) {
  return {
    access_token: sign("access", { uid, cm }, ACCESS_TTL_S),
    token_type: "Bearer",
    expires_in: ACCESS_TTL_S,
    refresh_token: sign("refresh", { uid, cm }, REFRESH_TTL_S),
    scope: "jawad",
  };
}

/** Made before «افصل الربط» was pressed (or exactly then): no longer valid. */
export const revoked = (iat: number, appMetadata: Record<string, unknown> | null | undefined) => {
  const at = Number(appMetadata?.mcp_revoked_at ?? 0);
  return Number.isFinite(at) && at > 0 && iat <= at;
};
