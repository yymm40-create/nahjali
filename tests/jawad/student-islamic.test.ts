import { describe, expect, it } from "vitest";
import { ISLAMIC_PREFIX, ISLAMIC_WAYS, isIslamicSource, isResearchSource } from "@config/jawad/student";
import { islamicAsk, islamicBody, islamicName } from "@/lib/jawad/student/islamic";
import { isIslamicMode } from "@/lib/islamic/text";
import { HANDLERS } from "@/lib/jawad/student/handlers";
import { CLAUDE_ONLY_KINDS } from "@/lib/jawad/student/jobs";
import { UserError } from "@/lib/api";

// «اربط الطالب الذكي بالذكاء الإسلامي»: صادق asks it instead of inventing or web-searching anything religious, its
// answer becomes a source of the material with its own references, and any of its answers can become study material.
describe("the bridge between «الطالب الذكي» and «الذكاء الإسلامي»", () => {
  it("is a job of its own, metered as Claude work", () => {
    expect(HANDLERS.islamic).toBeTruthy();
    expect(HANDLERS.islamic.label).toContain("الذكاء الإسلامي");
    expect(CLAUDE_ONLY_KINDS.has("islamic")).toBe(true);
  });

  it("the ways it can be asked are the library's own three", () => {
    expect(ISLAMIC_WAYS.map((w) => w.id)).toEqual(["auto", "narration", "research"]);
    for (const w of ISLAMIC_WAYS) expect(isIslamicMode(w.id)).toBe(true);
  });

  it("reads the question and the way, and refuses an empty question", () => {
    expect(islamicAsk({ question: "  وش معنى   الصلاة معراج المؤمن؟ ", mode: "narration" })).toEqual({ question: "وش معنى الصلاة معراج المؤمن؟", mode: "narration" });
    // anything that is not one of the three ways is the plain one
    expect(islamicAsk({ question: "س", mode: "deep" }).mode).toBe("auto");
    expect(islamicAsk({ question: "س" }).mode).toBe("auto");
    expect(() => islamicAsk({ question: "   " })).toThrow(UserError);
  });

  it("the written source keeps the answer AND its references", () => {
    const body = islamicBody({
      answer: "الصلاة معراج المؤمن [1]، وهي قربان كل تقي [2].",
      found: true,
      mode: "auto",
      sources: [
        { n: 1, url: "https://x/a", title: "الكافي", source: "الكليني", kind: "primary", primary: true },
        { n: 2, url: "", title: "نهج البلاغة", source: "", kind: "primary", primary: true },
      ],
      usd: 0,
    });
    expect(body).toContain("الصلاة معراج المؤمن [1]");
    expect(body).toContain("المصادر:");
    expect(body).toContain("[1] الكافي — الكليني — https://x/a");
    // a source with no link or author still appears, without dangling dashes
    expect(body).toContain("[2] نهج البلاغة");
    expect(body).not.toContain("[2] نهج البلاغة —");
  });

  it("says plainly when the library did not find the answer, instead of filling it in", () => {
    const body = islamicBody({ answer: "ما وجدت نصًا في هذا.", found: false, mode: "auto", sources: [], usd: 0 });
    expect(body.startsWith("⚠️")).toBe(true);
    expect(body).toContain("ما لقى في مكتبته");
  });

  it("the source's name marks where it came from, apart from a web research", () => {
    const name = islamicName("أدلة ولاية أمير المؤمنين عليه السلام");
    expect(name.startsWith(ISLAMIC_PREFIX)).toBe(true);
    expect(isIslamicSource(name)).toBe(true);
    expect(isResearchSource(name)).toBe(false);
    expect(isIslamicSource("بحث صادق: الكهرباء")).toBe(false);
    // a long question is cut, and the mark survives
    expect(isIslamicSource(islamicName("س".repeat(400)))).toBe(true);
    expect(islamicName("س".repeat(400)).length).toBeLessThan(ISLAMIC_PREFIX.length + 125);
  });
});
