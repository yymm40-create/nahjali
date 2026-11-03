import { describe, expect, it } from "vitest";
import { applyEdits, readEdits, readSearchReplace, SEARCH_REPLACE_FORMAT } from "@/lib/patch";

// A small change answered as a patch (src/lib/patch.ts): exact search/replace edits, shared by «مختبر الموشن» and
// «صانع الألعاب»; a patch that cannot be applied exactly fails as a whole, and the caller asks for the whole text.

const program = `scene({
  duration: 4,
  params: { accent: { label: "لون التمييز", type: "color", value: "#e8572a" } },
  draw(K, t, ctx) { ctx.fillStyle = K.p("accent", "#e8572a"); ctx.fillRect(0, 0, 10, 10); },
});`;

describe("applyEdits", () => {
  it("replaces an old text that occurs exactly once", () => {
    const r = applyEdits(program, [{ old: 'value: "#e8572a"', new: 'value: "#d4af37"' }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.text).toContain('value: "#d4af37"');
      expect(r.text).toContain('K.p("accent", "#e8572a")');
    }
  });

  it("fails when the old text is missing", () => {
    const r = applyEdits(program, [{ old: "#123456", new: "#000000" }]);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.why).toMatch(/edit 1 of 1: its old text is not in the text/);
  });

  it("fails when the old text occurs more than once (overlapping too), and when it is empty", () => {
    const r = applyEdits(program, [{ old: "#e8572a", new: "#d4af37" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toMatch(/more than once/);
    expect(applyEdits("aaa", [{ old: "aa", new: "b" }]).ok).toBe(false);
    expect(applyEdits(program, [{ old: "", new: "x" }]).ok).toBe(false);
    expect(applyEdits(program, []).ok).toBe(false);
  });

  it("applies the edits in order, each on the result of the one before, and fails the whole patch on any bad one", () => {
    expect(applyEdits("one two", [{ old: "one", new: "three" }, { old: "three two", new: "done" }])).toEqual({ ok: true, text: "done" });
    // the second edit no longer finds «one»: nothing is applied
    const r = applyEdits("one two", [{ old: "one", new: "three" }, { old: "one", new: "x" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.why).toMatch(/^edit 2 of 2/);
    // a later edit may match text an earlier one wrote
    expect(applyEdits("a-b", [{ old: "-", new: "--" }, { old: "a--b", new: "ok" }])).toEqual({ ok: true, text: "ok" });
    // an edit's new text may contain «$&» and the like: inserted as it is
    expect(applyEdits("x", [{ old: "x", new: "$&$1" }])).toEqual({ ok: true, text: "$&$1" });
  });
});

describe("reading a patch", () => {
  it("from JSON: strings only", () => {
    expect(readEdits([{ old: "a", new: "b" }, { old: 1, new: "c" }, null, { old: "d" }])).toEqual([{ old: "a", new: "b" }]);
    expect(readEdits("junk")).toEqual([]);
  });

  it("from SEARCH/REPLACE blocks, with the text around them ignored and an empty replacement allowed", () => {
    const answer = `Here it is:\n<<<<<<< SEARCH\nconst speed = 2;\n=======\nconst speed = 3;\n>>>>>>> REPLACE\n\n<<<<<<< SEARCH\n  // old\n  drawOld();\n=======\n>>>>>>> REPLACE\n`;
    expect(readSearchReplace(answer)).toEqual([
      { old: "const speed = 2;", new: "const speed = 3;" },
      { old: "  // old\n  drawOld();", new: "" },
    ]);
    expect(readSearchReplace(answer.replace(/\n/g, "\r\n"))).toEqual(readSearchReplace(answer));
    expect(SEARCH_REPLACE_FORMAT).toContain("<<<<<<< SEARCH");
  });

  it("is null when there is no block, or one is broken or cut off", () => {
    expect(readSearchReplace("WHOLE")).toBeNull();
    expect(readSearchReplace("<<<<<<< SEARCH\na\n=======\nb\n")).toBeNull();
    // a block missing its middle marker must not swallow the next one
    expect(readSearchReplace("<<<<<<< SEARCH\na\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nc\n=======\nd\n>>>>>>> REPLACE")).toBeNull();
    // a second block cut off in the middle
    expect(readSearchReplace("<<<<<<< SEARCH\na\n=======\nb\n>>>>>>> REPLACE\n<<<<<<< SEARCH\nc\n")).toBeNull();
  });

  it("an empty SEARCH is read, and refused when applied", () => {
    const e = readSearchReplace("<<<<<<< SEARCH\n=======\nb\n>>>>>>> REPLACE");
    expect(e).toEqual([{ old: "", new: "b" }]);
    expect(applyEdits("x", e!).ok).toBe(false);
  });
});
