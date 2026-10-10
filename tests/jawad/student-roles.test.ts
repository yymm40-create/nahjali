import { describe, expect, it } from "vitest";
import { SOURCE_ROLES, readSourceRole, rolesBrief, sourceRole } from "@config/jawad/student";

// «ساعات أعطيه ملف يكون إليه يمشي، وملف ثاني أو يوتيوب يكون المادة العلمية»: each source says what it IS, and the
// writer is told the difference — a template's SHAPE is followed, the material's FACTS are used.
describe("what each source is to the student", () => {
  it("names the three roles, each with a rule for the writer", () => {
    expect(SOURCE_ROLES.map((r) => r.id)).toEqual(["material", "template", "reference"]);
    for (const r of SOURCE_ROLES) {
      expect(r.ar.length).toBeGreaterThan(2);
      expect(r.rule.length).toBeGreaterThan(40);
    }
    expect(sourceRole("template")!.ar).toBe("نموذج أتبعه");
    expect(sourceRole("nope")).toBeNull();
  });

  it("anything else is the material, so every source from before the roles still works", () => {
    expect(readSourceRole("template")).toBe("template");
    expect(readSourceRole("reference")).toBe("reference");
    for (const v of [undefined, null, "", "MATERIAL", 3, {}, "model"]) expect(readSourceRole(v)).toBe("material");
  });

  it("says nothing when every source is the material (a plain project reads as before)", () => {
    expect(rolesBrief([])).toBe("");
    expect(rolesBrief(["material", "material", undefined])).toBe("");
  });

  it("tells the writer the shape is followed and the facts are not copied, when a template is there", () => {
    const brief = rolesBrief(["template", "material"]);
    expect(brief).toContain("TEMPLATE");
    expect(brief).toContain("MATERIAL");
    expect(brief).not.toContain("REFERENCE");
    // the two rules a template lives or dies by
    expect(brief).toMatch(/same sections in the same order/);
    expect(brief).toMatch(/Do NOT copy its subject matter/);
    // and which one wins in a clash
    expect(brief).toMatch(/the template wins/);
    expect(brief).toMatch(/the material wins/);
  });

  it("names only the roles that are really used", () => {
    expect(rolesBrief(["reference", "material"])).toContain("REFERENCE");
    expect(rolesBrief(["reference", "material"])).not.toContain("TEMPLATE");
    const all = rolesBrief(["material", "template", "reference"]);
    for (const w of ["MATERIAL", "TEMPLATE", "REFERENCE"]) expect(all).toContain(w);
  });
});
