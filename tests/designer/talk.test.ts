import { describe, expect, it } from "vitest";
import { decisionsOf, DESIGNER_EDIT_RULES, DESIGNER_TALK_RULES, DESIGNER_VERBOSE_RULES, fontAnswer, lastMark, paletteAnswer, stripMarks } from "@config/designer-talk";
import { CONTENT_FONTS, pinnedFont } from "@config/content-fonts";
import { CONTENT_PALETTES } from "@config/content-palettes";
import { PATH_EDIT_RULES, PATH_TALK_RULES } from "@config/content-paths";
import { fontFor, paletteFor } from "@/lib/designer/chat";
import { readPending, readQuestions } from "@/lib/designer/chats";
import { readDesign } from "@/lib/designer/layers";
import { systemText, turnText } from "@/lib/designer/persona";
import { pickedLook } from "@/lib/designer/produce";
import { cutPlace } from "@/lib/designer/split";

describe("«المصمم الذكي» on «صانع المحتوى»'s way", () => {
  it("carries the person's gallery picks as marks the server reads and the page hides", () => {
    const font = CONTENT_FONTS[0];
    const pal = CONTENT_PALETTES[3];
    const said = ["إعلان مجلس [نوع:husseini_mourning]", `• الخط: ${fontAnswer(font)}`, `• الألوان: ${paletteAnswer(pal)}`];
    // an old message's removed marks are hidden too
    expect(stripMarks(said[0])).toBe("إعلان مجلس");
    expect(lastMark(said, "خط")).toBe(font.id);
    expect(lastMark(said, "ألوان")).toBe(pal.id);
    expect(stripMarks(said[1])).not.toContain("[");
    // the last pick wins
    expect(lastMark([...said, `• الخط: ${fontAnswer("auto")}`], "خط")).toBe("auto");
    const d = decisionsOf(said);
    expect(d.map((x) => x.key)).toEqual(["font", "palette"]);
    expect(d[0].name).toBe(font.name);
    expect(d[1].name).toBe(pal.name);
    for (const x of d) expect(x.change.length).toBeGreaterThan(5);
  });

  it("holds «حيدرا ماكس» to the font and colours the person picked", () => {
    const font = CONTENT_FONTS.find((f) => f.id === "amiri")!;
    const pal = CONTENT_PALETTES[0];
    // the person's pick wins over كاظم's; «auto» or nothing leaves it to him (checked against the list)
    expect(fontFor([`• الخط: ${fontAnswer(font)}`], "cairo")).toBe("amiri");
    expect(fontFor([`• الخط: ${fontAnswer("auto")}`], "cairo")).toBe("cairo");
    expect(fontFor([], "not-a-font")).toBeUndefined();
    expect(paletteFor([`• الألوان: ${paletteAnswer(pal)}`])).toBe(pal.id);
    expect(paletteFor([`• الألوان: ${paletteAnswer("auto")}`])).toBeUndefined();
    const look = pickedLook({ fontId: "amiri", paletteId: pal.id });
    expect(pinnedFont(look)).toBe("amiri");
    for (const c of pal.colors) expect(look).toContain(c);
    expect(look).not.toContain("slide");
    expect(pickedLook({})).toBe("");
    // kept with the order waiting to be drawn
    const p = readPending({ id: "x", at: 1, kind: "wedding", aspect: "1:1", artwork: "a card", refs: [], layers: [], fontId: "amiri", paletteId: pal.id });
    expect(p?.fontId).toBe("amiri");
    expect(p?.paletteId).toBe(pal.id);
  });

  it("asks colours from the gallery of 100, and remembers what a split design came from", () => {
    expect(readQuestions([{ label: "الألوان", kind: "palettes", options: ["x"], multi: true }])).toEqual([{ label: "الألوان", kind: "palettes", options: [], multi: false }]);
    expect(readDesign({ aspect: "1:1", state: "failed", splitOf: "abc" })?.splitOf).toBe("abc");
  });

  it("talks short by default, longer on request, and reads edits precisely — the same rules as «صانع المحتوى»", () => {
    const sys = systemText("PERSONA");
    expect(sys).toContain(DESIGNER_TALK_RULES);
    expect(sys).toContain(DESIGNER_EDIT_RULES);
    expect(sys).not.toContain(DESIGNER_VERBOSE_RULES);
    expect(turnText([DESIGNER_VERBOSE_RULES], "REC")).toContain(DESIGNER_VERBOSE_RULES);
    // the content maker's own lines, carried over
    expect(PATH_TALK_RULES).toContain("ردّك لا يزيد عن ٣ أسطر");
    expect(DESIGNER_TALK_RULES).toContain("ردّك لا يزيد عن ٣ أسطر");
    expect(PATH_EDIT_RULES).toContain("غيّرت: …؛ والباقي كما هو");
    expect(DESIGNER_EDIT_RULES).toContain("غيّرت: …؛ والباقي كما هو");
    expect(DESIGNER_EDIT_RULES).toContain("\"change\": true");
  });

  it("keeps a split's cut-out exactly where the subject stands", () => {
    // a 1000×800 picture whose subject (200×400) stands at the right: left 700, top 300
    const at = cutPlace({ width: 1000, height: 800 }, { data: Buffer.from([1]), info: { width: 200, height: 400, trimOffsetLeft: -700, trimOffsetTop: -300 } }, { width: 1000, height: 800 });
    expect(at.x).toBe(80);
    expect(at.y).toBe(62.5);
    expect(at.w).toBe(20);
    expect(at.width).toBe(200);
  });
});
