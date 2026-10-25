import { describe, expect, it } from "vitest";
import { branchOf, byBranch, byLabel } from "@/lib/spend";
import { readAnswers } from "@config/jawad/tour";

const row = (label: string, delta: number, reason = "settle", ref = label, user_id = "u1") => ({ user_id, delta, reason, ref, label, created_at: "2026-10-12T00:00:00Z" });

describe("where the coins go", () => {
  it("sorts labels into branches", () => {
    expect(branchOf("محادثة حيدرا ماكس")).toBe("حيدرة كت");
    expect(branchOf("الطالب الذكي · الملخص")).toBe("الطالب الذكي");
    expect(branchOf("رد السيناريست")).toBe("الفيلم السينمائي");
    expect(branchOf("محادثة جواد")).toBe("محادثة جواد");
    expect(branchOf("JAWAD AI · التعديل الذكي · x")).toBe("التعديل الذكي والمخرج");
    expect(branchOf("شي غريب")).toBe("أخرى");
  });
  it("nets refunds, ignores money in, and lists smallest first", () => {
    const rows = [row("محادثة حيدرا ماكس", -500), row("رد السيناريست", -100), row("رد السيناريست", 40, "refund"), row("هدية", 1000, "grant")];
    const b = byBranch(rows);
    expect(b.map((x) => x.branch)).toEqual(["الفيلم السينمائي", "حيدرة كت"]);
    expect(b[0].halalas).toBe(60);
    expect(byLabel(rows)[0].label).toBe("محادثة حيدرا ماكس");
  });
  it("keeps only known answers", () => {
    const r = readAnswers({ make: ["محتوى ديني", "x"], level: ["محترف", "مبتدئ تمامًا"] }, "  قصص   أطفال ");
    expect(r.answers.make).toEqual(["محتوى ديني"]);
    expect(r.answers.level).toEqual(["محترف"]);
    expect(r.words).toBe("قصص أطفال");
  });
});
