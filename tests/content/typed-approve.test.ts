import { describe, expect, it } from "vitest";
import { isApproveWords, readSoundAsk } from "@/lib/content/chat";

describe("«اعتمد الصور» written, not pressed", () => {
  it("is an approval", () => {
    for (const t of ["اعتمد الصور", "اعتمد", "اعتمدها", "أعتمد الصور", "معتمدة", "موافقة", "ابدا سو الموشن", "ابدأ التحريك", "يلا سو الموشن", "تمام"]) expect(isApproveWords(t), t).toBe(true);
  });
  it("is not one when a change is asked with it", () => {
    for (const t of ["اعتمد بس غير الشريحة 3", "لا ما اعتمد", "عيد الشريحة 3", "اعتمد الصور لكن الصورة الثالثة فوق"]) expect(isApproveWords(t), t).toBe(false);
  });
});

describe("a slide's sound time written in the chat", () => {
  it("reads the customer's own message", () => {
    expect(readSoundAsk("عيد الشريحة 3 الصور صايرة فوق ، ودقائق الشريحة 3 ابيها تكون من 00:29.29 الى 00:42.36")).toEqual({ n: 3, from: 29.29, to: 42.36 });
  });
  it("reads Arabic digits and plain seconds", () => {
    expect(readSoundAsk("الشريحة ٢ من ١٢ إلى ٢٠")).toEqual({ n: 2, from: 12, to: 20 });
    expect(readSoundAsk("صوت السلايدة 4 من 1:05 لين 1:12")).toEqual({ n: 4, from: 65, to: 72 });
  });
  it("is null with no slide, two slides, or a time that runs backwards", () => {
    expect(readSoundAsk("من 0:12 إلى 0:20")).toBeNull();
    expect(readSoundAsk("الشريحة 2 والشريحة 3 من 0:12 إلى 0:20")).toBeNull();
    expect(readSoundAsk("الشريحة 2 من 0:30 إلى 0:20")).toBeNull();
  });
});

describe("a slide named in words", () => {
  it("reads «الشريحة الثالثة» with the time", () => {
    expect(readSoundAsk("ابغى وقت الشريحة الثالثة من 00:29.29 الى 00:42.36")).toEqual({ n: 3, from: 29.29, to: 42.36 });
    expect(readSoundAsk("عدل الوقت في الشريحة 3من 00:29.29 الى 00:42.36 \nوالكلام يبدا من بداية الشريحة")).toEqual({ n: 3, from: 29.29, to: 42.36 });
  });
});

import { timedPhrases } from "@/lib/content/chat";

describe("the slide map reads the heard words with their times", () => {
  it("writes each phrase with its seconds from the start of the file", () => {
    expect(timedPhrases([{ text: "اثنين:", from: 29.29, to: 29.8 }, { text: "العلاقات التي تتكون", from: 30.2, to: 34 }])).toBe("[0:29.29–0:29.80] «اثنين:»\n[0:30.20–0:34.00] «العلاقات التي تتكون»");
  });
});
