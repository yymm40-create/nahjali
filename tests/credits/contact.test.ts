import { describe, expect, it } from "vitest";
import { cleanContact, contactComplete, contactOf } from "@/lib/contact";

describe("account contact", () => {
  it("reads the typed name first, then the Google name; the number only from what was typed", () => {
    expect(contactOf({ user_metadata: { full_name: "Ali G", jw_name: "علي", jw_phone: "+966500000000" } })).toEqual({ name: "علي", phone: "+966500000000" });
    expect(contactOf({ user_metadata: { full_name: "Ali G" } })).toEqual({ name: "Ali G", phone: "" });
    expect(contactComplete(contactOf({ user_metadata: { full_name: "Ali G" } }))).toBe(false);
  });
  it("cleans a Saudi number and refuses a bad one", () => {
    expect(cleanContact({ name: "  يوسف   أحمد ", phone: "0559775339" })).toEqual({ name: "يوسف أحمد", phone: "+966559775339" });
    expect(() => cleanContact({ name: "ي", phone: "0559775339" })).toThrow();
    expect(() => cleanContact({ name: "يوسف", phone: "12" })).toThrow();
  });
});
