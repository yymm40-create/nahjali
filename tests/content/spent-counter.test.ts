// «أُخذ منك في هذي المحادثة» in «صانع المحتوى»: the counter is the whole conversation — «محمد باقر»'s replies, GPT Image 2's
// pictures (the slides, their painted pictures, the media step), the videos, and «حيدرا ماكس»'s code and reviews.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");

describe("the content maker's conversation counter", () => {
  it("adds every kind of charge to the same running total", () => {
    // the replies
    expect(read("src/app/api/content/chat/route.ts")).toContain("addContentSpent(user.id, r.chatId, r.worth)");
    // every GPT Image 2 picture made for a conversation (slides, painted pictures, the media step)
    const desk = read("src/lib/content/jawad.ts");
    expect(desk).toContain("if (who.chatId) await addContentSpent(who.id, who.chatId, receipt.coins)");
    expect(read("src/lib/content/produce.ts")).toMatch(/origin: o\.origin \?\? "", chatId \}/);
    const media = read("src/lib/content/media.ts");
    expect(media).toMatch(/origin: o\.origin \?\? "", chatId \}/);
    // a video counts once it is made
    expect(media).toContain("addContentSpent(c.userId, c.chatId, item.desk.coins)");
    // «حيدرا ماكس»'s code and reviews of a slide
    expect(read("src/app/api/jawad/claude-code/route.ts")).toContain('b.from === "content"');
    expect(read("src/components/claude-code/draw.ts")).toContain("o.chatId ? { chatId: o.chatId }");
    expect(read("src/lib/claude-code/picture.ts").match(/worth: r\.worth/g)?.length).toBe(3);
  });

  it("the page shows the total after every step, not only after a reply", () => {
    const page = read("src/components/jawad/content/ContentChat.tsx");
    expect(page).toContain('from: "content", chatId: id');
    expect(page.match(/if \(typeof r\.spent === "number"\) setSpent\(r\.spent\)/g)?.length).toBe(3);
    expect(read("src/app/api/content/produce/route.ts")).toContain("contentSpent(user.id, chatId)");
    expect(read("src/app/api/content/generate/route.ts")).toContain("contentSpent(user.id, chatId)");
  });

  it("counts two pictures that finish together (one queue per conversation)", () => {
    const chats = read("src/lib/content/chats.ts");
    expect(chats).toContain("spendQueue");
    expect(chats).toContain('.eq("id", chatId).eq("user_id", userId)');
  });
});
