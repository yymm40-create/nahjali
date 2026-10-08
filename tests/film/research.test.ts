import { describe, expect, it } from "vitest";
import { addFindings, decideFindings, parseFindings, readResearch, researchText, RESEARCH_LIMITS } from "@/lib/film/research";

describe("«بحث سجاد»: findings the person approves into the work", () => {
  it("reads Claude's findings by their «## » headings and drops the intro", () => {
    const text = "هذا ما لقيته:\n\n## الكوفة سنة ٣٦ هـ\nكانت عاصمة…\nسطر ثاني\n\n## أسواق الكوفة\nسوق الصيارفة…";
    const f = parseFindings(text, ["https://ar.wikipedia.org/x", "https://example.org/y"], "الكوفة زمن الإمام");
    expect(f.map((x) => x.title)).toEqual(["الكوفة سنة ٣٦ هـ", "أسواق الكوفة"]);
    expect(f[0].text).toBe("كانت عاصمة…\nسطر ثاني");
    expect(f[0].status).toBe("pending");
    expect(f[0].sources).toHaveLength(2);
    expect(f[0].scope).toBe("الكوفة زمن الإمام");
  });
  it("takes a text without headings as one finding, and nothing from an empty one", () => {
    const f = parseFindings("المسجد كان من الطين. وفيه سبعة أبواب.", [], "x");
    expect(f).toHaveLength(1);
    expect(f[0].title).toBe("المسجد كان من الطين");
    expect(parseFindings("  ", [], "x")).toEqual([]);
  });
  it("keeps at most the run's limit", () => {
    const text = Array.from({ length: 12 }, (_, i) => `## نتيجة ${i}\nنص`).join("\n");
    expect(parseFindings(text, [], "x")).toHaveLength(RESEARCH_LIMITS.findingsPerRun);
  });
  it("approves and drops by id, and only approved ones reach the work", () => {
    const r = addFindings(readResearch({ asked: "yes" }), parseFindings("## أ\nنص أ\n## ب\nنص ب", [], "x"));
    expect(r.asked).toBe("yes");
    const d = decideFindings(r, [r.items[0].id], [r.items[1].id]);
    expect(d.items.map((f) => f.status)).toEqual(["approved", "dropped"]);
    expect(researchText(d)).toContain("- أ: نص أ");
    expect(researchText(d)).not.toContain("نص ب");
    expect(researchText(r)).toBe("");
  });
  it("reads a missing or broken column as empty", () => {
    expect(readResearch(null)).toEqual({ items: [] });
    expect(readResearch({ asked: "maybe", items: [{ id: 1 }, { id: "a", title: "t", text: "x", status: "weird" }] }).items).toEqual([{ id: "a", title: "t", text: "x", status: "pending", sources: [], scope: "", at: "" }]);
  });
});
