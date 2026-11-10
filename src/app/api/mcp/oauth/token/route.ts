import { json, oauthError, preflight } from "@/lib/mcp/meta";
import { clientMark, pkceOk, tokenPair, verify, type CodeNote, type TokenNote } from "@/lib/mcp/tokens";
import { tokenUser } from "@/lib/mcp/user";

/**
 * «الجواد في كلاود وشات جي بي تي» · the token endpoint: a code (with its PKCE verifier) or a refresh token → a new pair.
 * Public clients (no secret), as Claude and ChatGPT register.
 */
export const POST = async (req: Request) => {
  const type = req.headers.get("content-type") ?? "";
  const b: Record<string, string> = {};
  if (type.includes("application/json")) {
    const j = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    for (const [k, v] of Object.entries(j)) if (typeof v === "string") b[k] = v;
  } else {
    const f = await req.formData().catch(() => null);
    f?.forEach((v, k) => typeof v === "string" && (b[k] = v));
  }
  const cid = b.client_id ?? "";
  if (!verify("client", cid)) return oauthError("invalid_client", "Unknown client_id.", 401);
  const cm = clientMark(cid);

  if (b.grant_type === "authorization_code") {
    const code = verify<CodeNote & Record<string, unknown>>("code", b.code);
    if (!code || code.cm !== cm || code.uri !== b.redirect_uri) return oauthError("invalid_grant", "The code is invalid or expired.");
    if (!pkceOk(b.code_verifier, code.cc)) return oauthError("invalid_grant", "PKCE verification failed.");
    if (!(await tokenUser(code.uid, code.iat))) return oauthError("invalid_grant", "The account is not available.");
    return json(tokenPair(code.uid, cm));
  }
  if (b.grant_type === "refresh_token") {
    const t = verify<TokenNote & Record<string, unknown>>("refresh", b.refresh_token);
    if (!t || t.cm !== cm) return oauthError("invalid_grant", "The refresh token is invalid or expired.");
    if (!(await tokenUser(t.uid, t.iat))) return oauthError("invalid_grant", "The link was removed. Connect again.");
    return json(tokenPair(t.uid, cm));
  }
  return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
};
export const OPTIONS = preflight;
