import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("Moyasar client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("MOYASAR_SECRET_KEY", "sk_test_abc");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is off without the key", async () => {
    vi.stubEnv("MOYASAR_SECRET_KEY", "");
    const { moyasarEnabled } = await import("@/lib/credits/moyasar");
    expect(moyasarEnabled()).toBe(false);
  });

  it("creates an invoice in halalas with the secret key as Basic auth", async () => {
    const f = vi.fn(async () => reply({ id: "inv-1", url: "https://checkout.moyasar.com/invoices/inv-1" }, 201));
    vi.stubGlobal("fetch", f);
    const { createInvoice } = await import("@/lib/credits/moyasar");
    const r = await createInvoice({ amount: 31, description: "باقة", callbackUrl: "https://x/w?order=o", successUrl: "https://x/r?order=o", backUrl: "https://x/c" });
    expect(r).toEqual({ id: "inv-1", url: "https://checkout.moyasar.com/invoices/inv-1" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.moyasar.com/v1/invoices");
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from("sk_test_abc:").toString("base64")}`);
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 3100, currency: "SAR", callback_url: "https://x/w?order=o", success_url: "https://x/r?order=o", back_url: "https://x/c" });
  });

  it("throws Moyasar's answer when it refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ type: "authentication_error" }, 401)));
    const { createInvoice, MoyasarError } = await import("@/lib/credits/moyasar");
    await expect(createInvoice({ amount: 3, description: "d", callbackUrl: "https://x", successUrl: "https://x", backUrl: "https://x" })).rejects.toBeInstanceOf(MoyasarError);
  });

  it("counts an invoice as paid only for the same id, SAR and the exact price", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply({ id: "inv-1", amount: 1250, currency: "SAR", status: "paid" })));
    const { getInvoice, invoicePaid } = await import("@/lib/credits/moyasar");
    const inv = await getInvoice("inv-1");
    expect(invoicePaid(inv, "inv-1", 12.5)).toBe(true);
    expect(invoicePaid(inv, "inv-2", 12.5)).toBe(false);
    expect(invoicePaid(inv, "inv-1", 13)).toBe(false);
    expect(invoicePaid({ ...inv, status: "initiated" }, "inv-1", 12.5)).toBe(false);
    expect(invoicePaid({ ...inv, currency: "USD" }, "inv-1", 12.5)).toBe(false);
  });
});
