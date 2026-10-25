import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DAILY, DAILY_DAYS, DAILY_START, FRIDAY_THEME, WEEK_THEMES, ayahRef, dailyFor, dailyNumber, dateOfDay, riwayaRef, themeOfDay } from "@/lib/mahdi/daily";
import { DEFAULT_WIDGETS, WIDGETS } from "@/lib/mahdi/home-widgets";
import { weekday } from "@/lib/mahdi/engine/dates";

// «آية اليوم ورواية اليوم»: a verse and a narration for each of 365 days, copied as they are, with their reference and no
// explanation. The days come in batches; these checks hold for every batch that is in.

const entries = [...DAILY.values()];

describe("the days", () => {
  it("start on 25 October 2026 (a Sunday) and run 365 days, then begin again", () => {
    expect(DAILY_START).toBe("2026-10-25");
    expect(weekday(DAILY_START)).toBe(0);
    expect(dailyNumber("2026-10-24")).toBeNull();
    expect(dailyNumber("2026-10-25")).toBe(1);
    expect(dailyNumber("2026-10-30")).toBe(6);
    expect(dailyNumber("2027-10-24")).toBe(365);
    expect(dailyNumber("2027-10-25")).toBe(1);
    expect(dateOfDay(365)).toBe("2027-10-24");
  });

  it("have 53 weekly themes (the 365th day is a week of its own)", () => {
    expect(WEEK_THEMES).toHaveLength(53);
    expect(Math.ceil(DAILY_DAYS / 7)).toBe(53);
  });

  it("every Friday is about waiting by working, and only a Friday is", () => {
    for (const e of entries) {
      const friday = weekday(dateOfDay(e.day)) === 5;
      expect(e.theme === FRIDAY_THEME, `day ${e.day}`).toBe(friday);
      expect(e.theme, `day ${e.day}`).toBe(themeOfDay(e.day));
    }
  });
});

describe("what is in", () => {
  it("is numbered once each, from day 1 with no gap", () => {
    const nums = entries.map((e) => e.day).sort((a, b) => a - b);
    expect(new Set(nums).size).toBe(nums.length);
    nums.forEach((n, i) => expect(n).toBe(i + 1));
    expect(nums.length).toBeGreaterThanOrEqual(60);
  });

  it("has a verse and a narration with all their references, and nothing else", () => {
    for (const e of entries) {
      expect(Object.keys(e).sort(), `day ${e.day}`).toEqual(["ayah", "day", "riwaya", "tags", "theme"]);
      expect(Object.keys(e.ayah).sort()).toEqual(["ayah_number", "surah", "surah_number", "text_ar"]);
      expect(Object.keys(e.riwaya).sort()).toEqual(["book", "chapter_ar", "hadith_number", "is_excerpt", "source_url", "speaker", "text_ar", "volume"]);
      expect(e.ayah.text_ar.length, `day ${e.day}`).toBeGreaterThan(5);
      expect(e.ayah.surah_number).toBeGreaterThanOrEqual(1);
      expect(e.ayah.surah_number).toBeLessThanOrEqual(114);
      expect(e.ayah.ayah_number).toBeGreaterThanOrEqual(1);
      expect(e.riwaya.text_ar.length, `day ${e.day}`).toBeGreaterThan(5);
      expect(e.riwaya.source_url, `day ${e.day}`).toMatch(/^https:\/\/thaqalayn\.com\/ar\/(hadith|duas)\//);
      expect(e.riwaya.speaker.length).toBeGreaterThan(3);
      expect(e.riwaya.book.length).toBeGreaterThan(2);
      expect(typeof e.riwaya.is_excerpt).toBe("boolean");
    }
  });

  it("never repeats a narration or a verse's place on two days", () => {
    expect(new Set(entries.map((e) => e.riwaya.source_url)).size).toBe(entries.length);
    expect(new Set(entries.map((e) => e.riwaya.text_ar)).size).toBe(entries.length);
  });

  it("carries no emoji", () => {
    for (const e of entries) expect(JSON.stringify(e), `day ${e.day}`).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("is shown for today, and nothing before the start or for a day that has not arrived", () => {
    expect(dailyFor("2026-10-25")?.day).toBe(1);
    expect(dailyFor("2026-10-24")).toBeNull();
    expect(dailyFor("2027-10-24")).toBeNull();
  });
});

describe("how it is printed", () => {
  it("writes the references the way the pages read them", () => {
    expect(ayahRef({ surah: "الحجر", surah_number: 15, ayah_number: 99, text_ar: "" })).toBe("الحجر: ٩٩");
    const first = DAILY.get(1)!;
    expect(riwayaRef(first.riwaya)).toBe("الكافي، ج٢، باب استواء العمل والمداومة عليه، ح٢");
    // a prayer of al-Sahifa has no volume and its number is already a sentence
    expect(riwayaRef(DAILY.get(3)!.riwaya)).toBe("الصحيفة السجادية، دعاء الصباح والمساء، الدعاء ١٣ في ترتيب الموقع، المقاطع ٣٠-٣١");
  });
});

describe("on the home", () => {
  it("is a card of its own, on by default after «اضغط وأنجز»", () => {
    expect(WIDGETS.some((w) => w.id === "daily")).toBe(true);
    expect(DEFAULT_WIDGETS.slice(0, 4)).toEqual(["habits", "reading", "quick", "daily"]);
  });

  it("writes no explanation beside the text (the card prints only the fields above)", () => {
    const card = readFileSync(new URL("../../src/components/mahdi/DailyCard.tsx", import.meta.url), "utf8");
    for (const f of ["explanation", "tags", "theme", "action"]) expect(card, f).not.toContain(`.${f}`);
  });
});
