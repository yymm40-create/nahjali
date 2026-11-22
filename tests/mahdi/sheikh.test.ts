import { describe, expect, it } from "vitest";
import { cleanQuestion, linkPieces, plainAnswer, sheikhLeft, sheikhWording, SHEIKH_DAILY } from "@/lib/mahdi/sheikh";

describe("«الشيخ الذكي»", () => {
  it("counts the day's questions", () => {
    const now = Date.parse("2026-11-22T12:00:00Z");
    const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
    expect(sheikhLeft([hoursAgo(1), hoursAgo(2), hoursAgo(30)], now)).toBe(SHEIKH_DAILY - 2);
    expect(sheikhLeft(Array.from({ length: SHEIKH_DAILY + 3 }, () => hoursAgo(1)), now)).toBe(0);
  });

  it("keeps a question up to 1000 letters", () => {
    expect(cleanQuestion("  ما فضل زيارة عاشوراء؟ ")).toBe("ما فضل زيارة عاشوراء؟");
    expect(cleanQuestion(" ")).toBeNull();
    expect(cleanQuestion("x".repeat(1001))).toBeNull();
    expect(cleanQuestion(5)).toBeNull();
  });

  it("writes «صلى الله عليه وآله», never ﷺ", () => {
    expect(sheikhWording("روي عن النبي ﷺ")).toBe("روي عن النبي صلى الله عليه وآله");
    expect(sheikhWording("رسول الله صلى الله عليه وسلم")).toBe("رسول الله صلى الله عليه وآله");
  });

  it("cuts a line into text, links, bold and source numbers", () => {
    expect(linkPieces("روي «النص» [2]، والمصدر https://thaqalayn.com/chapter/1/2/3.")).toEqual([
      { t: "text", v: "روي «النص» " },
      { t: "cite", v: 2 },
      { t: "text", v: "، والمصدر " },
      { t: "link", v: "https://thaqalayn.com/chapter/1/2/3" },
      { t: "text", v: "." },
    ]);
    expect(linkPieces("**الكافي** ج٢")).toEqual([
      { t: "bold", v: "الكافي" },
      { t: "text", v: " ج٢" },
    ]);
  });

  it("drops headings and list stars but keeps bold", () => {
    expect(plainAnswer("## عنوان\n- أولًا **مهم**")).toBe("عنوان\n• أولًا **مهم**");
  });
});
