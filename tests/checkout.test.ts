import { describe, expect, it } from "vitest";
import { checkoutUrl, formPaymentPaid, landing, readTicket, signTicket } from "@/lib/credits/checkout";
import type { Payment } from "@/lib/credits/moyasar";
import { rulesFor } from "@/lib/rate-limit";

// «صفحة الدفع»: the ticket is ours and unchanged, and a payment opens only the purchase it was made for, at its exact price.
const T = { k: "credits" as const, ref: "11111111-2222-3333-4444-555555555555", a: 11900, d: "رصيد الجواد الذكي — باقة المحترف", back: "/jawad-ai/credits?cancelled=1" };
const pay = (over: Partial<Payment> = {}): Payment => ({ id: "p1", amount: 11900, currency: "SAR", status: "paid", invoiceId: "", description: "", metadata: { kind: "credits", ref: T.ref }, ...over });

describe("checkout ticket", () => {
  it("reads back what was signed", () => {
    const t = readTicket(signTicket(T));
    expect(t).toMatchObject(T);
  });
  it("refuses a changed, foreign or old ticket", () => {
    const s = signTicket(T);
    const [body, sig] = s.split(".");
    const forged = Buffer.from(JSON.stringify({ ...T, a: 100, exp: Date.now() + 1e6 })).toString("base64url");
    expect(readTicket(`${forged}.${sig}`)).toBeNull();
    expect(readTicket(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(readTicket("nonsense")).toBeNull();
    expect(readTicket(undefined)).toBeNull();
    expect(readTicket(signTicket(T, Date.now() - 2 * 86400_000))).toBeNull();
  });
  it("refuses a back link off our site", () => {
    expect(readTicket(signTicket({ ...T, back: "//evil.example" }))).toBeNull();
    expect(readTicket(signTicket({ ...T, back: "https://evil.example" }))).toBeNull();
  });
  it("builds our page's address", () => {
    const u = new URL(checkoutUrl("https://www.aljawadai.app", T));
    expect(u.pathname).toBe("/jawad-ai/checkout");
    expect(readTicket(u.searchParams.get("t"))).toMatchObject(T);
  });
});

describe("form payment check", () => {
  it("accepts a paid payment for this purchase at its price", () => {
    expect(formPaymentPaid(pay(), "credits", T.ref, 11900)).toBe(true);
  });
  it("refuses anything else", () => {
    expect(formPaymentPaid(pay({ status: "initiated" }), "credits", T.ref, 11900)).toBe(false);
    expect(formPaymentPaid(pay({ amount: 100 }), "credits", T.ref, 11900)).toBe(false);
    expect(formPaymentPaid(pay({ currency: "USD" }), "credits", T.ref, 11900)).toBe(false);
    expect(formPaymentPaid(pay({ metadata: { kind: "credits", ref: "another-order" } }), "credits", T.ref, 11900)).toBe(false);
    expect(formPaymentPaid(pay({ metadata: { kind: "course", ref: T.ref } }), "credits", T.ref, 11900)).toBe(false);
    expect(formPaymentPaid(pay({ metadata: {} }), "credits", T.ref, 11900)).toBe(false);
  });
});

describe("checkout landing and limits", () => {
  it("sends the buyer back where they were", () => {
    expect(landing("credits", true, { ref: "o1" })).toBe("/jawad-ai/credits?paid=o1");
    expect(landing("course", false, { coursePath: "/jawad-ai/course", courseId: "c1" })).toBe("/jawad-ai/course/c1?unpaid=1");
    expect(landing("offer10", true, { offerPath: "/jawad-ai/offer" })).toBe("/jawad-ai/offer?paid=1");
    expect(landing("pay", true, { paymentId: "p1" })).toBe("/jawad-ai/pay/done?id=p1");
    expect(landing("", false)).toBe("/jawad-ai");
  });
  it("limits the return and the webhook", () => {
    expect(rulesFor("/api/checkout/return", "GET").some((r) => r.key === "checkout")).toBe(true);
    expect(rulesFor("/api/checkout/webhook", "POST").some((r) => r.key === "checkout")).toBe(true);
  });
});
