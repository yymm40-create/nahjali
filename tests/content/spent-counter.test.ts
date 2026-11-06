// «أُخذ منك في هذي المحادثة» in «صانع المحتوى»: the whole conversation, worked out from the records — «محمد باقر»'s
// replies, GPT Image 2's pictures and videos (its «c-…»/«m-…» jobs), «حيدرا ماكس»'s code and reviews — so a
// conversation started before this was counted shows its full total too.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BAQIR_LABEL, jobHalalas, tallyContent, type SpentJob } from "@/lib/content/spent";

const read = (p: string) => readFileSync(p, "utf8");
const M = 60_000;
const key = (c: string) => `${c}-${"a".repeat(32)}`;
const job = (o: Partial<SpentJob>): SpentJob => ({ id: "j", key: key("c"), at: 0, chargeState: "settled", status: "succeeded", priceCoins: 83, ...o });

describe("what each job took", () => {
  it("its price when held or settled, a free account's value when made, nothing when given back", () => {
    expect(jobHalalas(job({}))).toBe(83);
    expect(jobHalalas(job({ chargeState: "held", status: "running" }))).toBe(83);
    expect(jobHalalas(job({ chargeState: "none" }))).toBe(83);
    expect(jobHalalas(job({ chargeState: "none", status: "failed" }))).toBe(0);
    expect(jobHalalas(job({ chargeState: "refunded", status: "failed" }))).toBe(0);
  });
});

describe("each charge goes to its own conversation", () => {
  const chats = [
    { id: "A", createdAt: 0, updatedAt: 60 * M },
    { id: "B", createdAt: 100 * M, updatedAt: 200 * M },
  ];
  const files = [
    { chatId: "A", at: 10 * M, jobId: "jA" },
    { chatId: "A", at: 30 * M, jobId: null }, // a slide «حيدرا ماكس» drew
    { chatId: "B", at: 150 * M, jobId: null },
  ];

  it("adds the replies, the pictures and «حيدرا ماكس»'s work, each to the right conversation", () => {
    const t = tallyContent({
      chats,
      files,
      jobs: [
        job({ id: "jA", at: 9 * M }), // its file is in A
        job({ id: "jX", at: 140 * M, priceCoins: 105 }), // no file of its own: the next file (B)
        job({ id: "jS", key: "studio-1", at: 11 * M }), // the studio's own job: not the content maker's
        job({ id: "jR", at: 12 * M, chargeState: "refunded" }), // failed, given back
      ],
      calls: [
        { at: 5 * M, label: BAQIR_LABEL, halalas: 92 },
        { at: 120 * M, label: BAQIR_LABEL, halalas: 88 },
        { at: 28 * M, label: "حيدرا ماكس · شريحة متحركة", halalas: 37 },
        { at: 29 * M, label: "حيدرا ماكس · مراجعة الشريحة المتحركة 1", halalas: 52 },
        { at: 148 * M, label: "حيدرا ماكس · رسم الصورة", halalas: 40 }, // a slide followed: the content maker's
        { at: 300 * M, label: "حيدرا ماكس · رسم الصورة", halalas: 999 }, // the studio's: no slide followed
        { at: 20 * M, label: "Claude · something else", halalas: 500 },
      ],
    });
    expect(t.get("A")).toBe(83 + 92 + 37 + 52);
    expect(t.get("B")).toBe(105 + 88 + 40);
  });
});

describe("wired", () => {
  it("every place that shows the counter reads the whole total", () => {
    expect(read("src/app/api/content/chats/route.ts")).toContain("contentSpent(user.id, id)");
    expect(read("src/app/api/content/chat/route.ts")).toContain("contentSpent(user.id, r.chatId)");
    expect(read("src/app/api/content/produce/route.ts")).toContain("contentSpent(user.id, chatId)");
    expect(read("src/app/api/content/generate/route.ts")).toContain("contentSpent(user.id, chatId)");
    const page = read("src/components/jawad/content/ContentChat.tsx");
    expect(page.match(/if \(typeof r\.spent === "number"\) setSpent\(r\.spent\)/g)?.length).toBe(3);
  });
});
