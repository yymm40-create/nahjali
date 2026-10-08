import { describe, expect, it } from "vitest";
import { locksText, missingLocks, missingText, readLocks } from "@/lib/jawad/edit-locks";

const previous = `Pixar-like 3D animation, soft pastel palette. @omar, a 10-year-old boy with curly black hair, wears a white thobe and a red shemagh, stands in a sunlit old Kuwaiti courtyard with a palm tree. Medium shot, slow dolly-in, 35mm. Warm golden-hour light. @omar says: "Yā jaddī, wayn al-mifṭāḥ?"`;

describe("smart edit locks", () => {
  it("keeps only check words that are really in the previous prompt", () => {
    const locks = readLocks(
      {
        locks: [
          { kind: "style", keep: "Pixar-like 3D animation in soft pastels", check: ["Pixar-like 3D", "pastel palette"] },
          { kind: "wardrobe", keep: "@omar wears a white thobe and a red shemagh", check: ["white thobe", "red shemagh", "blue jeans"] },
          { kind: "dialogue", keep: "@omar asks his grandfather where the key is", check: ["wayn al-mifṭāḥ"] },
          { kind: "weird", keep: "", check: ["x"] },
          { kind: "camera", keep: "Medium shot with a slow dolly-in", check: ["handheld"] },
        ],
      },
      previous,
    );
    expect(locks.map((l) => l.kind)).toEqual(["style", "wardrobe", "dialogue", "camera"]);
    expect(locks[1].check).toEqual(["white thobe", "red shemagh"]);
    expect(locks[3].check).toEqual([]); // kept for the writer, never checked
    expect(readLocks(null, previous)).toEqual([]);
    expect(readLocks({ locks: "x" }, previous)).toEqual([]);
  });

  it("finds the locks a new prompt dropped (case, punctuation and marks ignored)", () => {
    const locks = readLocks(
      { locks: [
        { kind: "style", keep: "Pixar-like 3D", check: ["Pixar-like 3D"] },
        { kind: "wardrobe", keep: "thobe and shemagh", check: ["white thobe", "red shemagh"] },
        { kind: "lighting", keep: "golden hour", check: ["golden-hour light"] },
      ] },
      previous,
    );
    const kept = "PIXAR-LIKE 3D animation… @omar in a white thobe, red shemagh; golden hour light.";
    expect(missingLocks(kept, locks)).toEqual([]);
    const lost = "Realistic film. @omar in a white thobe. Night.";
    expect(missingLocks(lost, locks).map((l) => l.kind)).toEqual(["style", "wardrobe", "lighting"]);
    expect(missingText(missingLocks(lost, locks))).toContain('"red shemagh"');
  });

  it("is written for the prompt writer with its key words", () => {
    const locks = readLocks({ locks: [{ kind: "dialogue", keep: "the line", check: ["wayn al-mifṭāḥ"] }] }, previous);
    expect(locksText(locks)).toMatch(/MUST keep/);
    expect(locksText(locks)).toContain("word for word");
    expect(locksText([])).toBe("");
  });
});
