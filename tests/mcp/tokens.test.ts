import { createHash } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.MCP_SIGNING_SECRET = "test-secret-for-the-connector";
});
afterEach(() => vi.useRealTimers());

const load = () => import("@/lib/mcp/tokens");

describe("connector tokens", () => {
  it("signs and verifies a note of its own kind only", async () => {
    const t = await load();
    const code = t.sign("code", { uid: "u1", cm: "c", uri: "https://claude.ai/api/mcp/auth_callback", cc: "x" }, 60);
    expect(t.verify("code", code)?.uid).toBe("u1");
    expect(t.verify("access", code)).toBeNull();
    expect(t.verify("code", code.slice(0, -2) + "AA")).toBeNull();
    expect(t.verify("code", "jmk_" + Buffer.from(JSON.stringify({ k: "code", uid: "evil", iat: 1 })).toString("base64url") + ".abc")).toBeNull();
  });

  it("refuses an expired note", async () => {
    const t = await load();
    const a = t.sign("access", { uid: "u1", cm: "c" }, 60);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(t.verify("access", a)).toBeNull();
  });

  it("checks PKCE S256", async () => {
    const t = await load();
    const verifier = "a".repeat(50);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(t.pkceOk(verifier, challenge)).toBe(true);
    expect(t.pkceOk("b".repeat(50), challenge)).toBe(false);
    expect(t.pkceOk("short", challenge)).toBe(false);
  });

  it("lets Claude, ChatGPT and a local program be redirect addresses, nobody else", async () => {
    const t = await load();
    expect(t.redirectAllowed("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(t.redirectAllowed("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(t.redirectAllowed("http://localhost:6274/oauth/callback")).toBe(true);
    expect(t.redirectAllowed("https://evil.com/cb")).toBe(false);
    expect(t.redirectAllowed("https://claude.ai.evil.com/cb")).toBe(false);
    expect(t.redirectAllowed("http://claude.ai/cb")).toBe(false);
    expect(t.redirectAllowed("javascript:alert(1)")).toBe(false);
  });

  it("stops tokens made before «افصل الربط»", async () => {
    const t = await load();
    expect(t.revoked(100, { mcp_revoked_at: 150 })).toBe(true);
    expect(t.revoked(200, { mcp_revoked_at: 150 })).toBe(false);
    expect(t.revoked(200, {})).toBe(false);
  });
});

describe("a file from a link", () => {
  it("never reaches the server's own network", async () => {
    const { privateAddress, downloadPublic } = await import("@/lib/mcp/fetch-file");
    for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.3.4", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fd00::1", "::ffff:127.0.0.1", "100.64.0.1"]) expect(privateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "142.250.72.14", "2606:4700::1111"]) expect(privateAddress(ip)).toBe(false);
    await expect(downloadPublic("http://169.254.169.254/latest/meta-data")).rejects.toMatchObject({ status: 400 });
    await expect(downloadPublic("http://localhost:3000/x")).rejects.toMatchObject({ status: 400 });
    await expect(downloadPublic("file:///etc/passwd")).rejects.toMatchObject({ status: 400 });
  });
});
