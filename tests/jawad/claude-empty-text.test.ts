import { describe, expect, it } from "vitest";
import { cleanClaudeTurns } from "@/lib/film/anthropic";

describe("Claude request message cleanup", () => {
  it("drops empty text blocks and keeps attachment-only turns", () => {
    expect(cleanClaudeTurns([
      { role: "user", content: "   " },
      { role: "user", content: [{ type: "text", text: "" }, { type: "image", url: "https://x.test/ref.jpg" }] },
      { role: "assistant", content: [{ type: "text", text: "تم" }, { type: "text", text: "\n" }] },
    ])).toEqual([
      { role: "user", content: [{ type: "image", url: "https://x.test/ref.jpg" }] },
      { role: "assistant", content: [{ type: "text", text: "تم" }] },
    ]);
  });

  it("joins equal roles exposed by removing an empty turn", () => {
    expect(cleanClaudeTurns([
      { role: "user", content: "الأول" },
      { role: "assistant", content: "" },
      { role: "user", content: "الثاني" },
    ])).toEqual([{ role: "user", content: [{ type: "text", text: "الأول" }, { type: "text", text: "الثاني" }] }]);
  });
});
