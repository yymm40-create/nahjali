import { json, oauthError, preflight } from "@/lib/mcp/meta";
import { redirectAllowed, sign } from "@/lib/mcp/tokens";

/**
 * «الجواد في كلاود وشات جي بي تي» · dynamic client registration (RFC 7591). Nothing is stored: the client id is a signed
 * note of the client's name and redirect addresses (Claude's, ChatGPT's, or a program on the person's computer).
 */
export const POST = async (req: Request) => {
  const b = (await req.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null;
  const uris = Array.isArray(b?.redirect_uris) ? b.redirect_uris.filter((u): u is string => typeof u === "string").slice(0, 10) : [];
  if (!uris.length) return oauthError("invalid_redirect_uri", "redirect_uris is required.");
  const bad = uris.find((u) => !redirectAllowed(u));
  if (bad) return oauthError("invalid_redirect_uri", `Redirect not allowed: ${bad.slice(0, 200)}`);
  const name = String(b?.client_name ?? "").trim().slice(0, 80) || "تطبيق";
  const clientId = sign("client", { name, uris });
  return json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: name,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    201,
  );
};
export const OPTIONS = preflight;
