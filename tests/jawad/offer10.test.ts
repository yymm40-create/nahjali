import { describe, expect, it } from "vitest";
import { generatorById } from "@config/jawad/generators";
import { OFFER10, OFFER10_GRANTS, offer10End, offer10GrantFor, offer10Open, offer10Start } from "@config/jawad/offer10";

describe("عرض الـ٢٥ ريال", () => {
  it("is open for exactly 48 hours", () => {
    expect(offer10End() - offer10Start()).toBe(48 * 3600_000);
    expect(offer10Open(offer10Start() - 1)).toBe(false);
    expect(offer10Open(offer10Start())).toBe(true);
    expect(offer10Open(offer10End())).toBe(false);
    expect(OFFER10.priceSar).toBe(25);
  });
  it("gives what the owner set, on generators that exist", () => {
    const by = Object.fromEntries(OFFER10_GRANTS.map((g) => [g.key, g]));
    expect(by.nano).toMatchObject({ cap: null, hours: 24, resolution: "1K" });
    expect(by.gpt).toMatchObject({ cap: 20, hours: 48 });
    expect(by.seedance).toMatchObject({ cap: 4, resolution: "480p" });
    for (const g of OFFER10_GRANTS) {
      const def = generatorById(g.generatorId);
      expect(def, g.generatorId).toBeTruthy();
      if (g.resolution) expect(def!.options.find((o) => o.key === "resolution" && o.kind === "choice")).toBeTruthy();
    }
    expect(offer10GrantFor("byteplus-seedance-2-5")).toBeNull();
  });
});
