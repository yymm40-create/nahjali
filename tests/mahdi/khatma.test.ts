import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import quran from "../../assets/quran/quran-uthmani.json";
import { AYAH_COUNTS, QUARTER_STARTS, QUARTER_WORDS, SURA_NAMES } from "@/lib/mahdi/khatma/quran-map";
import {
  DIVISIONS,
  followingEnd,
  khatmaEnd,
  nextSlot,
  nightName,
  nightText,
  portionCount,
  portionQuarters,
  portionStates,
  portionTitle,
  portionVerses,
  type Division,
} from "@/lib/mahdi/khatma/portions";
import { portionText } from "@/lib/mahdi/khatma/text";
import { navGroups } from "@/components/mahdi/nav";
import { MAHDI_FEATURES } from "@config/mahdi/app-knowledge";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";

const SURAS = (quran as { suras: { name: string; bismillah: string | null; ayat: string[] }[] }).suras;
const read = (p: string) => readFileSync(p, "utf8");

describe("«الختمة العلوية»: the Quran text is the verified one, whole and unchanged", () => {
  it("114 surahs, 6236 verses, the known count of each surah", () => {
    expect(SURAS).toHaveLength(114);
    expect(SURAS.reduce((n, s) => n + s.ayat.length, 0)).toBe(6236);
    expect(SURAS.map((s) => s.ayat.length)).toEqual([...AYAH_COUNTS]);
    expect(AYAH_COUNTS.slice(0, 3)).toEqual([7, 286, 200]);
    expect(AYAH_COUNTS[113]).toBe(6);
    expect(SURA_NAMES[0]).toBe("الفاتحة");
    expect(SURA_NAMES[113]).toBe("الناس");
  });

  it("every verse, letter for letter, is the Tanzil Uthmani 1.1 download (pause marks and rub signs; no sajdah signs)", () => {
    // sha256 of the 6236 verses joined by new lines, taken from Tanzil's own XML when the file was made
    const all = SURAS.flatMap((s) => s.ayat).join("\n");
    expect(createHash("sha256").update(all, "utf8").digest("hex")).toBe("ed65ac4bcb5b3a21723fc2ff2660fa826ba1f3acb3c1923f5d5445327c5350ea");
    expect(all).not.toContain("۩");
    expect((quran as { notice: string }).notice).toContain("Tanzil Project");
    expect((quran as { notice: string }).notice).toContain("CHANGING IT IS NOT ALLOWED");
  });

  it("«بسم الله» opens every surah but at-Tawba; the Fatiha's is its first verse", () => {
    const b = SURAS[0].ayat[0];
    expect(b.startsWith("بِسْمِ")).toBe(true);
    SURAS.forEach((s, i) => {
      if (i === 0 || i === 8) expect(s.bismillah, s.name).toBeNull();
      else expect(s.bismillah === b || s.bismillah === b[0] + "ّ" + b.slice(1), s.name).toBe(true);
    });
  });

  it("240 hizb quarters; the text's own ۞ signs sit exactly on every quarter that does not open a surah", () => {
    expect(QUARTER_STARTS).toHaveLength(240);
    expect(QUARTER_WORDS).toHaveLength(240);
    const signs: [number, number][] = [];
    SURAS.forEach((s, i) => s.ayat.forEach((a, j) => a.includes("۞") && signs.push([i + 1, j + 1])));
    expect(signs).toHaveLength(199);
    expect(signs).toEqual(QUARTER_STARTS.filter(([, a]) => a !== 1).map(([s, a]) => [s, a]));
    // Tanzil's metadata alone puts quarter 106 at al-Hijr 50; its text and quran.com put it at «نَبِّئْ عِبَادِىٓ» (15:49)
    expect(QUARTER_STARTS[105]).toEqual([15, 49]);
    expect(SURAS[14].ayat[48].startsWith("\u06de نَب")).toBe(true);
    // in order, each inside its surah
    for (let i = 1; i < 240; i++) {
      const [s0, a0] = QUARTER_STARTS[i - 1];
      const [s, a] = QUARTER_STARTS[i];
      expect(s > s0 || (s === s0 && a > a0)).toBe(true);
      expect(a).toBeLessThanOrEqual(AYAH_COUNTS[s - 1]);
    }
  });

  it("the 30 juz start where Tanzil's juz list says (a second, separate list)", () => {
    const JUZ = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
    expect(Array.from({ length: 30 }, (_, j) => portionVerses("juz", j + 1).from)).toEqual(JUZ);
    expect(portionVerses("juz", 30)).toEqual({ from: [78, 1], to: [114, 6] });
    expect(portionVerses("juz", 1)).toEqual({ from: [1, 1], to: [2, 141] });
  });
});

describe("the portions cover the whole Quran, once, in order", () => {
  it.each(DIVISIONS)("%s", (d: Division) => {
    expect(portionCount(d)).toBe({ juz: 30, hizb: 60, half: 120, quarter: 240 }[d]);
    let next: [number, number] = [1, 1];
    let verses = 0;
    for (let n = 1; n <= portionCount(d); n++) {
      const { from, to } = portionVerses(d, n);
      expect(from, `${d} ${n}`).toEqual(next);
      const text = portionText(d, n);
      const ayat = text.suras.flatMap((s) => s.ayat.map((a) => [s.sura, a.n]));
      expect(ayat[0]).toEqual(from);
      expect(ayat.at(-1)).toEqual(to);
      for (const s of text.suras) for (const a of s.ayat) expect(a.text).toBe(SURAS[s.sura - 1].ayat[a.n - 1]);
      verses += ayat.length;
      next = to[1] < AYAH_COUNTS[to[0] - 1] ? [to[0], to[1] + 1] : [to[0] + 1, 1];
    }
    expect(verses).toBe(6236);
    expect(next).toEqual([115, 1]);
  });

  it("a surah that begins inside a portion brings its «بسم الله»; at-Tawba and a surah begun earlier do not", () => {
    const j10 = portionText("juz", 10).suras; // al-Anfal 41 … at-Tawba 92
    expect(j10.map((s) => s.sura)).toEqual([8, 9]);
    expect(j10.every((s) => s.bismillah === null)).toBe(true);
    const j30 = portionText("juz", 30).suras;
    expect(j30).toHaveLength(37);
    expect(j30.every((s) => s.bismillah)).toBe(true);
    expect(portionText("juz", 1).suras[0]).toMatchObject({ sura: 1, bismillah: null });
  });

  it("names: juz, hizb, half and quarter", () => {
    expect(portionTitle("juz", 3)).toBe("الجزء 3");
    expect(portionTitle("hizb", 5)).toBe("الحزب 5");
    expect(portionTitle("half", 10)).toBe("الحزب 5 · النصف الثاني");
    expect(portionTitle("quarter", 19)).toBe("الحزب 5 · الربع الثالث");
    expect(portionQuarters("half", 10)).toEqual({ fromQ: 19, toQ: 20 });
    expect(() => portionQuarters("juz", 31)).toThrow();
  });
});

describe("who may take what", () => {
  it("mine read / being read, someone else's hidden, read before = grey, the rest free", () => {
    const states = portionStates(
      "hizb",
      [
        { portion: 1, userId: "me", status: "done" },
        { portion: 2, userId: "me", status: "reading" },
        { portion: 3, userId: "other", status: "reading" },
      ],
      "me",
      // last khatma I read juz 3 (quarters 17–24) = hizb 5 and 6
      [{ fromQ: 17, toQ: 24 }],
    );
    expect(states.slice(0, 7)).toEqual(["done", "reading", "taken", "free", "blocked", "blocked", "free"]);
    expect(states).toHaveLength(60);
  });
  it("a quarter read before locks the whole juz that contains it", () => {
    const states = portionStates("juz", [], "me", [{ fromQ: 9, toQ: 9 }]);
    expect(states[1]).toBe("blocked");
    expect(states.filter((s) => s === "blocked")).toHaveLength(1);
  });
});

describe("the weekly schedule", () => {
  const riyadh = { weeks: 1, endDow: 4, endHour: 21, timeZone: "Asia/Riyadh" };
  it("ends on the chosen night in the group's time zone", () => {
    // Monday 20 Oct 2026, 10:00 Riyadh → Thursday 22 Oct 21:00 Riyadh = 18:00 UTC
    const from = new Date("2026-10-19T07:00:00Z");
    expect(nextSlot(from, "Asia/Riyadh", 4, 21).toISOString()).toBe("2026-10-22T18:00:00.000Z");
    expect(khatmaEnd(from, riyadh).toISOString()).toBe("2026-10-22T18:00:00.000Z");
    expect(khatmaEnd(from, { ...riyadh, weeks: 2 }).toISOString()).toBe("2026-10-29T18:00:00.000Z");
    // at the very moment it ends, the next one is a week on
    expect(nextSlot(new Date("2026-10-22T18:00:00Z"), "Asia/Riyadh", 4, 21).toISOString()).toBe("2026-10-29T18:00:00.000Z");
  });
  it("keeps the local hour across a clock change", () => {
    // London leaves summer time on 25 Oct 2026: 21:00 is 20:00 UTC before and 21:00 UTC after
    const a = nextSlot(new Date("2026-10-19T12:00:00Z"), "Europe/London", 4, 21);
    expect(a.toISOString()).toBe("2026-10-22T20:00:00.000Z");
    expect(nextSlot(a, "Europe/London", 4, 21).toISOString()).toBe("2026-10-29T21:00:00.000Z");
  });
  it("after a long gap the next khatma still ends ahead", () => {
    const prev = new Date("2026-10-01T18:00:00Z");
    const now = new Date("2026-10-19T07:00:00Z");
    expect(followingEnd(prev, now, riyadh).toISOString()).toBe("2026-10-22T18:00:00.000Z");
  });
  it("speaks of the night: Thursday 9 pm is «ليلة الجمعة»", () => {
    expect(nightName(4, 21)).toBe("ليلة الجمعة");
    expect(nightName(6, 20)).toBe("ليلة الأحد");
    expect(nightText("2026-10-22T18:00:00Z", "Asia/Riyadh")).toMatch(/^ليلة الجمعة 22 أكتوبر/);
  });
});

describe("the branch is wired in", () => {
  it("is in the side menu, inside every private group, and in the knowledge", () => {
    expect(navGroups("ali").flatMap((g) => g.items).map((i) => i.href)).toContain("/mahdi/khatma");
    expect(read("src/app/mahdi/(app)/groups/[id]/page.tsx")).toContain("/mahdi/khatma/${id}");
    expect(MAHDI_FEATURES.some((f) => f.id === "khatma")).toBe(true);
    expect(JAWAD_KNOWLEDGE).toContain("الختمة العلوية");
  });
  it("the database: one reader per portion, server-only tables, the source named on the page", () => {
    const sql = read("supabase/migrations/0080_mahdi_khatma.sql");
    expect(sql).toContain("primary key (khatma_id, portion)");
    expect(sql).toContain("unique (group_id, number)");
    expect(sql).toMatch(/revoke all on public\.mahdi_khatma_settings, public\.mahdi_khatmas, public\.mahdi_khatma_claims from anon, authenticated/);
    expect(read("src/components/mahdi/khatma/QuranText.tsx")).toContain("tanzil.net");
    // a member who leaves or is removed gives back what they were reading
    expect(read("src/app/api/mahdi/groups/[id]/route.ts").match(/releaseReader\(/g)).toHaveLength(2);
  });
});
