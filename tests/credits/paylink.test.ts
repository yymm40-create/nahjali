import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Paylink client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PAYLINK_API_ID", "APP_ID_TEST");
    vi.stubEnv("PAYLINK_SECRET_KEY", "secret-test");
    vi.stubEnv("PAYLINK_BASE", "https://restpilot.paylink.sa/");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off without the keys", async () => {
    vi.stubEnv("PAYLINK_API_ID", "");
    const { paylinkEnabled } = await import("@/lib/credits/paylink");
    expect(paylinkEnabled()).toBe(false);
  });

  it("also reads the keys under the names API_ID and secret_key", async () => {
    vi.stubEnv("PAYLINK_API_ID", "");
    vi.stubEnv("PAYLINK_SECRET_KEY", "");
    vi.stubEnv("API_ID", "ID2");
    vi.stubEnv("secret_key", "S2");
    const { paylinkEnabled } = await import("@/lib/credits/paylink");
    expect(paylinkEnabled()).toBe(true);
  });

  it("authenticates on the test base, then adds an invoice with the token and the order id", async () => {
    const f = vi.fn(async (url: string) => (url.endsWith("/api/auth") ? reply({ id_token: "tok" }) : reply({ transactionNo: "T1", url: "https://payment.paylink.sa/pay/info/T1" })));
    vi.stubGlobal("fetch", f);
    const { addInvoice } = await import("@/lib/credits/paylink");
    const r = await addInvoice({ orderNumber: "o-1", amount: 10, clientName: "علي", clientMobile: "0500000000", title: "باقة", callBackUrl: "https://x/return?order=o-1", cancelUrl: "https://x/c" });
    expect(r).toEqual({ transactionNo: "T1", url: "https://payment.paylink.sa/pay/info/T1" });
    const [authUrl, authInit] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(authUrl).toBe("https://restpilot.paylink.sa/api/auth");
    expect(JSON.parse(String(authInit.body))).toEqual({ apiId: "APP_ID_TEST", secretKey: "secret-test", persistToken: false });
    const [invUrl, invInit] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(invUrl).toBe("https://restpilot.paylink.sa/api/addInvoice");
    expect((invInit.headers as Record<string, string>).authorization).toBe("Bearer tok");
    const body = JSON.parse(String(invInit.body));
    expect(body).toMatchObject({ orderNumber: "o-1", amount: 10, currency: "SAR", products: [{ price: 10, qty: 1 }] });
  });

  it("retries once with a fresh token when the first is refused", async () => {
    let auths = 0;
    const f = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth")) return reply({ id_token: `tok${++auths}` });
      return (init?.headers as Record<string, string>).authorization === "Bearer tok1" ? reply({ error: "expired" }, 401) : reply({ orderNumber: "o-1", amount: 10, orderStatus: "Paid" });
    });
    vi.stubGlobal("fetch", f);
    const { getInvoice } = await import("@/lib/credits/paylink");
    expect(await getInvoice("T1")).toEqual({ orderNumber: "o-1", amount: 10, status: "Paid" });
    expect(auths).toBe(2);
  });

  it("counts an invoice as paid only for the same order, the same price and a Paid status", async () => {
    const { invoicePaid } = await import("@/lib/credits/paylink");
    const inv = { orderNumber: "o-1", amount: 10, status: "Paid" };
    expect(invoicePaid(inv, "o-1", 10)).toBe(true);
    expect(invoicePaid({ ...inv, status: "Pending" }, "o-1", 10)).toBe(false);
    expect(invoicePaid({ ...inv, status: "Canceled" }, "o-1", 10)).toBe(false);
    expect(invoicePaid(inv, "o-2", 10)).toBe(false);
    expect(invoicePaid({ ...inv, amount: 1 }, "o-1", 10)).toBe(false);
    expect(invoicePaid({ ...inv, amount: NaN }, "o-1", 10)).toBe(false);
  });
});
