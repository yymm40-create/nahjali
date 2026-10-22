import { describe, expect, it } from "vitest";
import { composeStory, emptyMap, parseStory, stationSeconds, STATIONS } from "@/lib/film/story-map";

describe("«🗺️ ساعدني أكتبها»: the story map", () => {
  it("has five stations, each with a question, a hint and an example", () => {
    expect(STATIONS.map((s) => s.name)).toEqual(["الخطاف", "التأسيس", "التصعيد", "الانقلاب", "النتيجة"]);
    for (const s of STATIONS) expect(s.question && s.hint && s.example).toBeTruthy();
  });
  it("gives a minute its seconds (0–6, 6–16, 16–32, 32–47, 47–60) and scales a longer scene", () => {
    expect(stationSeconds(60)).toEqual([[0, 6], [6, 16], [16, 32], [32, 47], [47, 60]]);
    expect(stationSeconds(120)).toEqual([[0, 12], [12, 32], [32, 64], [64, 94], [94, 120]]);
    expect(stationSeconds(null).every((x) => x === null)).toBe(true);
  });
  it("turns the answers into a story text, leaving empty stations out, and reads it back", () => {
    const a = { ...emptyMap(), idea: "أب يصلّح دراجة ولده", hook: "صوت مطرقة الفجر.", turn: "يلقى أبوه نايم جنبها.\nوإيده ملفوفة." };
    const text = composeStory(a, 60);
    expect(text).toBe("الفكرة: أب يصلّح دراجة ولده\n\n١. الخطاف (الثانية ٠–٦): صوت مطرقة الفجر.\n٤. الانقلاب (الثانية ٣٢–٤٧): يلقى أبوه نايم جنبها.\nوإيده ملفوفة.");
    expect(parseStory(text)).toEqual(a);
    // a film or a series: no seconds, same reading back
    expect(parseStory(composeStory(a, null))).toEqual(a);
  });
  it("says a story written freely was not written on the map", () => {
    expect(parseStory("ولد يحلم يصير طيّار، ويبني طيارة من الكرتون.")).toBeNull();
    expect(parseStory("")).toBeNull();
  });
});
