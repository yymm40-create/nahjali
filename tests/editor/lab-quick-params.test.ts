import { describe, expect, it } from "vitest";
import { quickParams, type ParamField } from "@/lib/editor/scene/quick-params";

// «خلّ اللون ذهبي» on a scene that exposes the colour (or the text) as a param: set on the page, no call to حيدرا ماكس.
// Anything less sure goes to him as before.

const one: ParamField[] = [
  { id: "title", label: "العنوان", type: "text", value: "هلا" },
  { id: "accent", label: "لون التمييز", type: "color", value: "#e8572a" },
];
const many: ParamField[] = [
  { id: "title", label: "العنوان", type: "text", value: "هلا" },
  { id: "sub", label: "السطر الثاني", type: "text", value: "حياك" },
  { id: "bg", label: "لون الخلفية", type: "color", value: "#0b0b10" },
  { id: "accent", label: "لون التمييز", type: "color", value: "#e8572a" },
];

describe("a note that is only a param", () => {
  it("a colour on the scene's only colour, however it is written", () => {
    for (const m of ["خلّ اللون ذهبي", "خل اللون ذهبي", "غيّر اللون للذهبي", "خليه ذهبي", "اللون #D4AF37"]) expect(quickParams(m, one, {})?.values, m).toEqual({ accent: "#d4af37" });
    expect(quickParams("خلها حمراء", one, { title: "مرحبا" })?.values).toEqual({ title: "مرحبا", accent: "#e53935" });
    expect(quickParams("اللون #fff", one, {})?.value).toBe("#ffffff");
  });

  it("a colour on the one its label names, when there are several", () => {
    expect(quickParams("خلّ لون الخلفية أسود", many, {})?.values).toEqual({ bg: "#000000" });
    expect(quickParams("خل الخلفية سودا", many, {})?.field.id).toBe("bg");
    expect(quickParams("غير لون التمييز إلى وردي", many, {})?.field.id).toBe("accent");
  });

  it("a text: by its label or the only text, or by the words it shows now", () => {
    expect(quickParams("خل العنوان «مرحبا»", many, {})?.values).toEqual({ title: "مرحبا" });
    expect(quickParams('اكتب "أهلين"', one, {})?.values).toEqual({ title: "أهلين" });
    expect(quickParams("بدّل «حياك» بـ «يا هلا»", many, {})?.values).toEqual({ sub: "يا هلا" });
    // the person's own value counts as what is shown now
    expect(quickParams("بدل «مرحبا» ب «هلا والله»", many, { title: "مرحبا" })?.values).toEqual({ title: "هلا والله" });
  });

  it("anything less sure goes to حيدرا ماكس", () => {
    // which colour?
    expect(quickParams("خلّ اللون ذهبي", many, {})).toBeNull();
    // another change in the same note, or a target the scene does not expose
    expect(quickParams("خلّ اللون ذهبي وكبّر الشعار", one, {})).toBeNull();
    expect(quickParams("خل الشعار ذهبي", one, {})).toBeNull();
    expect(quickParams("كبّر الشعار", one, {})).toBeNull();
    expect(quickParams("أسرع شوي", one, {})).toBeNull();
    // two colours, a colour and a text, an unknown colour word, a text no field shows
    expect(quickParams("خله ذهبي أو فضي", one, {})).toBeNull();
    expect(quickParams("خل العنوان «مرحبا» ذهبي", one, {})).toBeNull();
    expect(quickParams("خله ذهبي غامق", one, {})).toBeNull();
    expect(quickParams("بدل «غير موجود» ب «x»", many, {})).toBeNull();
    // several texts and none named
    expect(quickParams("اكتب «مرحبا»", many, {})).toBeNull();
    // a scene with no params
    expect(quickParams("خل اللون ذهبي", [], {})).toBeNull();
  });
});
