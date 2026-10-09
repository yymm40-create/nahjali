import { describe, expect, it } from "vitest";
import { hexColors, OPTIONS_CLOSE, OPTIONS_OPEN, OPTIONS_RULE, splitColors, splitOptions } from "@/lib/chat-options";

describe("clickable answers", () => {
  it("takes the options block off the reply and returns its options", () => {
    const r = splitOptions(`هلا بك، وش نوع اللعبة؟\n\n${OPTIONS_OPEN}\n- لعبة جماعية\n- لعبة فردية\n3) أي شي\n• تلقائي\n${OPTIONS_CLOSE}`);
    expect(r.body).toBe("هلا بك، وش نوع اللعبة؟");
    expect(r.options).toEqual(["لعبة جماعية", "لعبة فردية", "أي شي", "تلقائي"]);
  });
  it("is lenient: no closing tag, spaces in the tags, the last block wins", () => {
    expect(splitOptions("سؤال\n[[ خيارات ]]\n- أ\n- ب").options).toEqual(["أ", "ب"]);
    const two = splitOptions(`${OPTIONS_OPEN}\n- قديم\n${OPTIONS_CLOSE}\nنص\n${OPTIONS_OPEN}\n- جديد\n${OPTIONS_CLOSE}`);
    expect(two.options).toEqual(["جديد"]);
    expect(two.body).toContain("قديم");
  });
  it("leaves a reply without a block alone, and caps what it reads", () => {
    expect(splitOptions("مرحبا")).toEqual({ body: "مرحبا", options: [] });
    const many = splitOptions(`${OPTIONS_OPEN}\n${Array.from({ length: 12 }, (_, i) => `- خيار ${i}`).join("\n")}\n${OPTIONS_CLOSE}`);
    expect(many.options).toHaveLength(8);
    expect(splitOptions(`${OPTIONS_OPEN}\n- ${"ك".repeat(300)}\n${OPTIONS_CLOSE}`).options[0]).toHaveLength(140);
  });
  it("tells a plain-text persona the format, the colour format, and that the page adds «اكتب إجابة مختلفة»", () => {
    expect(OPTIONS_RULE).toContain(OPTIONS_OPEN);
    expect(OPTIONS_RULE).toContain(OPTIONS_CLOSE);
    expect(OPTIONS_RULE).toContain("#RRGGBB");
    expect(OPTIONS_RULE).toContain("اكتب إجابة مختلفة");
  });
});

describe("colours as swatches", () => {
  it("finds #RRGGBB colours, once each, upper-cased", () => {
    expect(hexColors("كحلي وذهبي — #0b1f3a #D4AF37 #FFFFFF #0B1F3A و #12345 ليس لونًا")).toEqual(["#0B1F3A", "#D4AF37", "#FFFFFF"]);
    expect(hexColors("بلا ألوان")).toEqual([]);
  });
  it("cuts a text into plain runs and colours", () => {
    expect(splitColors("أ #ff0000 ب")).toEqual([{ text: "أ ", color: false }, { text: "#FF0000", color: true }, { text: " ب", color: false }]);
    expect(splitColors("نص فقط")).toEqual([{ text: "نص فقط", color: false }]);
  });
});
