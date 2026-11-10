import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";

// the account behind a token, the signed-in person on the consent page, and the wallet: mocked (no database here)
const user = { id: "11111111-1111-1111-1111-111111111111", email: "person@example.com", app_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
vi.mock("@/lib/mcp/user", () => ({ tokenUser: vi.fn(async (uid: string) => (uid === user.id ? user : null)), revokeAll: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
vi.mock("@/lib/coins", async (orig) => ({ ...(await orig<object>()), coinBalance: vi.fn(async () => 1250) }));
vi.mock("@/lib/jawad/server/access", async (orig) => ({ ...(await orig<object>()), freeFor: vi.fn(async () => false) }));

// the MCP route loads every section's route module the first time: slower than the default 5 seconds
vi.setConfig({ testTimeout: 60_000 });

beforeAll(() => {
  process.env.MCP_SIGNING_SECRET = "test-secret-for-the-connector";
});

const O = "https://www.aljawadai.app";
const CB = "https://claude.ai/api/mcp/auth_callback";

async function link() {
  const reg = await (await import("@/app/api/mcp/oauth/register/route")).POST(new Request(`${O}/api/mcp/oauth/register`, { method: "POST", body: JSON.stringify({ client_name: "Claude", redirect_uris: [CB] }) }));
  expect(reg.status).toBe(201);
  const { client_id } = await reg.json();
  const verifier = "v".repeat(60);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const q = new URLSearchParams({ response_type: "code", client_id, redirect_uri: CB, code_challenge: challenge, code_challenge_method: "S256", state: "s1" });
  const auth = await (await import("@/app/api/mcp/oauth/authorize/route")).GET(new Request(`${O}/api/mcp/oauth/authorize?${q}`));
  expect(auth.status).toBe(302);
  const page = new URL(auth.headers.get("location")!);
  expect(page.pathname).toBe("/jawad-ai/connect/authorize");
  const form = new FormData();
  form.set("r", page.searchParams.get("r")!);
  form.set("decision", "allow");
  const ok = await (await import("@/app/api/mcp/oauth/approve/route")).POST(new Request(`${O}/api/mcp/oauth/approve`, { method: "POST", body: form, headers: { origin: O } }));
  expect(ok.status).toBe(303);
  const back = new URL(ok.headers.get("location")!);
  expect(back.origin + back.pathname).toBe(CB);
  expect(back.searchParams.get("state")).toBe("s1");
  const tokenRoute = (await import("@/app/api/mcp/oauth/token/route")).POST;
  const body = new URLSearchParams({ grant_type: "authorization_code", code: back.searchParams.get("code")!, redirect_uri: CB, client_id, code_verifier: verifier });
  const tok = await tokenRoute(new Request(`${O}/api/mcp/oauth/token`, { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } }));
  expect(tok.status).toBe(200);
  return { client_id, verifier, tokens: await tok.json(), tokenRoute, code: back.searchParams.get("code")! };
}

const rpc = async (token: string | null, body: unknown) =>
  (await import("@/app/api/mcp/route")).POST(new Request(`${O}/api/mcp`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) } }));

describe("the connector, end to end", () => {
  it("asks for a sign-in with the resource metadata address", async () => {
    const r = await rpc(null, { jsonrpc: "2.0", id: 1, method: "initialize", params: {} });
    expect(r.status).toBe(401);
    expect(r.headers.get("www-authenticate")).toContain(`${O}/.well-known/oauth-protected-resource/api/mcp`);
  });

  it("links an account, then answers initialize, tools/list and a tool", async () => {
    const { tokens } = await link();
    expect(tokens.access_token).toMatch(/^jma_/);
    const init = await (await rpc(tokens.access_token, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })).json();
    expect(init.result.protocolVersion).toBe("2025-06-18");
    const list = await (await rpc(tokens.access_token, { jsonrpc: "2.0", id: 2, method: "tools/list" })).json();
    const names = list.result.tools.map((t: { name: string }) => t.name);
    for (const n of ["jawad_balance", "jawad_add_file", "jawad_upload_page", "jawad_my_files", "studio_generate", "carousel_chat", "designer_chat", "student_new", "haidara_new_project"]) expect(names).toContain(n);
    // ChatGPT hands a file attached to the chat to this argument
    expect(list.result.tools.find((t: { name: string }) => t.name === "jawad_add_file")._meta["openai/fileParams"]).toEqual(["file"]);
    const bal = await (await rpc(tokens.access_token, { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "jawad_balance", arguments: {} } })).json();
    expect(bal.result.isError).toBeUndefined();
    expect(bal.result.structuredContent.balance_halalas).toBe(1250);
    const note = await rpc(tokens.access_token, { jsonrpc: "2.0", method: "notifications/initialized" });
    expect(note.status).toBe(202);
  });

  it("refreshes, and refuses a wrong verifier or another client's code", async () => {
    const { tokens, tokenRoute, client_id, code } = await link();
    const fresh = await tokenRoute(new Request(`${O}/x`, { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id }) }));
    expect(fresh.status).toBe(200);
    const bad = await tokenRoute(new Request(`${O}/x`, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: CB, client_id, code_verifier: "w".repeat(60) }) }));
    expect(bad.status).toBe(400);
    const reg = await (await import("@/app/api/mcp/oauth/register/route")).POST(new Request(`${O}/r`, { method: "POST", body: JSON.stringify({ redirect_uris: [CB] }) }));
    const other = (await reg.json()).client_id;
    const stolen = await tokenRoute(new Request(`${O}/x`, { method: "POST", body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: CB, client_id: other, code_verifier: "v".repeat(60) }) }));
    expect(stolen.status).toBe(400);
  });

  it("refuses a redirect outside Claude / ChatGPT at registration", async () => {
    const reg = await (await import("@/app/api/mcp/oauth/register/route")).POST(new Request(`${O}/r`, { method: "POST", body: JSON.stringify({ redirect_uris: ["https://evil.com/cb"] }) }));
    expect(reg.status).toBe(400);
  });
});
