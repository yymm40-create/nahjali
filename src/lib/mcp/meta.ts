// «الجواد في كلاود وشات جي بي تي» · the addresses a connector discovers (RFC 9728 and RFC 8414). Server only.

import { NextResponse } from "next/server";

export const MCP_PATH = "/api/mcp";

/** The site's address as the request reached it (www.aljawadai.app in production; the preview's own on a preview). */
export const originOf = (req: Request) => new URL(req.url).origin;

export const resourceUrl = (origin: string) => `${origin}${MCP_PATH}`;

/** RFC 9728: which authorization server protects the connector. */
export const protectedResource = (origin: string) => ({
  resource: resourceUrl(origin),
  authorization_servers: [origin],
  bearer_methods_supported: ["header"],
  scopes_supported: ["jawad"],
  resource_name: "الجواد الذكي · JAWAD AI",
  resource_documentation: `${origin}/jawad-ai/connect`,
});

/** RFC 8414 (also served as openid-configuration: some clients look there first). */
export const authorizationServer = (origin: string) => ({
  issuer: origin,
  authorization_endpoint: `${origin}${MCP_PATH}/oauth/authorize`,
  token_endpoint: `${origin}${MCP_PATH}/oauth/token`,
  registration_endpoint: `${origin}${MCP_PATH}/oauth/register`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"],
  scopes_supported: ["jawad"],
  service_documentation: `${origin}/jawad-ai/connect`,
});

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id",
};

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...CORS, "Cache-Control": "no-store", ...headers } });

export const preflight = () => new Response(null, { status: 204, headers: CORS });

/** An OAuth error answer (RFC 6749 §5.2). */
export const oauthError = (error: string, description: string, status = 400) => json({ error, error_description: description }, status);
