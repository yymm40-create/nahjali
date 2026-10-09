import { describe, expect, it } from "vitest";
import { countdown, DEFAULT_SETTINGS, embedOf, offerFor, offersAt, readSettings, savingPct, cleanPhone, waLink, COURSE, type CourseSettings } from "@config/course";

const H = 3_600_000;
const T0 = Date.parse("2026-10-10T12:00:00Z");
const S: CourseSettings = { ...DEFAULT_SETTINGS, launchAt: new Date(T0).toISOString() };
const at = (hours: number) => offersAt(S, T0 + hours * H);

describe("the three prices, by the hours since the reel came out", () => {
  it("is «قريبًا» until the owner starts the clock", () => {
    expect(offersAt(DEFAULT_SETTINGS, T0).phase).toBe("soon");
    expect(offersAt(DEFAULT_SETTINGS, T0).offers).toEqual([]);
    const before = offersAt(S, T0 - 1000);
    expect(before.phase).toBe("soon");
    expect(before.endsAt).toBe(T0);
  });

  it("first 24 hours: ONE offer, the whole course, at 40 (worth 230)", () => {
    for (const h of [0, 0.01, 12, 23.99]) {
      const o = at(h);
      expect(o.phase).toBe("A");
      expect(o.offers).toHaveLength(1);
      expect(o.offers[0]).toMatchObject({ product: "combo", price: 40, was: 230 });
      expect(o.endsAt).toBe(T0 + 24 * H);
    }
    expect(savingPct(at(1).offers[0])).toBe(83);
    expect(at(1).next).toContain("المباشرة ¤40");
    expect(at(1).next).not.toMatch(/ريال/);
  });

  it("24 to 48 hours: live stays 40 (was 80), recorded is 80 (was 150) with the gift", () => {
    for (const h of [24, 30, 47.99]) {
      const o = at(h);
      expect(o.phase).toBe("B");
      expect(o.offers.map((x) => [x.product, x.price, x.was])).toEqual([["live", 40, 80], ["recorded", 80, 150]]);
      expect(o.endsAt).toBe(T0 + 48 * H);
    }
    expect(savingPct(at(30).offers[0])).toBe(50);
    expect(savingPct(at(30).offers[1])).toBe(47);
  });

  it("after 48 hours: live 80 (no strike: it is the usual price), recorded 100 (was 150), for good", () => {
    for (const h of [48, 100, 5000]) {
      const o = at(h);
      expect(o.phase).toBe("C");
      expect(o.offers.map((x) => [x.product, x.price, x.was])).toEqual([["live", 80, 80], ["recorded", 100, 150]]);
      expect(o.endsAt).toBeNull();
    }
    expect(savingPct(at(60).offers[0])).toBe(0);
    expect(savingPct(at(60).offers[1])).toBe(33);
  });

  it("the gift (زهرات) comes only with what the owner set, and only on the recorded one", () => {
    const s = readSettings({ ...S, bonus: { comboA: 0, recordedB: 30, recordedC: 20 } });
    expect(offersAt(s, T0 + 30 * H).offers.map((o) => o.bonus)).toEqual([0, 30]);
    expect(offersAt(s, T0 + 60 * H).offers.map((o) => o.bonus)).toEqual([0, 20]);
    expect(at(30).offers.every((o) => o.bonus === 0)).toBe(true);
  });

  it("a product is on sale only in its phase", () => {
    expect(offerFor(S, "combo", T0 + 1 * H)?.price).toBe(40);
    expect(offerFor(S, "live", T0 + 1 * H)).toBeNull();
    expect(offerFor(S, "combo", T0 + 30 * H)).toBeNull();
    expect(offerFor(S, "recorded", T0 + 30 * H)?.price).toBe(80);
    expect(offerFor(S, "recorded", T0 + 60 * H)?.price).toBe(100);
    expect(offerFor(S, "live", T0 + 60 * H)?.price).toBe(80);
  });

  it("follows the owner's own hours and prices", () => {
    const s = readSettings({ launchAt: S.launchAt, hoursA: 6, hoursB: 12, prices: { comboA: 25 } });
    expect(offersAt(s, T0 + 5 * H).offers[0].price).toBe(25);
    expect(offersAt(s, T0 + 7 * H).phase).toBe("B");
    expect(offersAt(s, T0 + 13 * H).phase).toBe("C");
  });
});

describe("reading the owner's settings", () => {
  it("fills what is missing with his numbers and clamps nonsense", () => {
    const s = readSettings({ prices: { comboA: -5, liveB: "abc", recordedB: 1e9 }, hoursA: 0, hoursB: 0, launchAt: "not a date", videoUrl: "http://x.com/a.mp4", groupLink: "javascript:alert(1)", bank: { iban: "SA03 8000 0000" } });
    expect(s.prices).toEqual({ comboA: 1, liveB: 40, recordedB: 100000, liveC: 80, recordedC: 100 });
    expect(s.hoursA).toBe(1);
    expect(s.hoursB).toBeGreaterThan(s.hoursA);
    expect(s.launchAt).toBeNull();
    expect(s.videoUrl).toBe("");
    expect(s.groupLink).toBe("");
    expect(s.bank.iban).toBe("SA03 8000 0000");
    expect(readSettings(null)).toEqual(readSettings({}));
    expect(readSettings(JSON.parse(JSON.stringify(S)))).toEqual(S);
  });

  it("the WhatsApp group is the owner's own by default, and an empty one he saves stays empty", () => {
    expect(DEFAULT_SETTINGS.groupLink).toBe("https://chat.whatsapp.com/GM4dDzGRevpIlb55Q1HEzo?mode=gi_t");
    expect(readSettings({}).groupLink).toBe(DEFAULT_SETTINGS.groupLink);
    expect(readSettings({ groupLink: "" }).groupLink).toBe("");
    expect(readSettings({ groupLink: "http://x.com" }).groupLink).toBe("");
  });

  it("keeps only safe https links and storage paths", () => {
    const s = readSettings({ groupLink: "https://chat.whatsapp.com/abc", recordedLink: "https://x.com/y z", videoPath: "course/3f2a1b4c-0000-4000-8000-000000000000.mp4", posterPath: "../x.png" });
    expect(s.groupLink).toBe("https://chat.whatsapp.com/abc");
    expect(s.recordedLink).toBe("");
    expect(s.videoPath).toMatch(/^course\//);
    expect(s.posterPath).toBeNull();
  });

  it("keeps days with a title and a few points, and the default days when none", () => {
    expect(readSettings({ days: [{ title: "", points: ["x"] }] }).days).toEqual(DEFAULT_SETTINGS.days);
    const s = readSettings({ days: [{ title: "اليوم الأول", points: ["أ", "", "ب"] }] });
    expect(s.days).toEqual([{ title: "اليوم الأول", points: ["أ", "ب"] }]);
  });
});

describe("phone numbers, WhatsApp, count down and the video", () => {
  it("takes a Saudi mobile in any way it is written", () => {
    for (const x of ["0501234567", "050 123 4567", "٠٥٠١٢٣٤٥٦٧", "+966501234567", "00966501234567", "501234567", "966501234567"]) expect(cleanPhone(x), x).toBe("+966501234567");
    expect(cleanPhone("+971 50 123 4567")).toBe("+971501234567");
    for (const x of ["", "abc", "123", "+0123456789", "05012", "+9665012345678901234", null, 42, "0501234567x"]) expect(cleanPhone(x), String(x)).toBeNull();
  });

  it("opens WhatsApp with a ready message", () => {
    expect(waLink("+966501234567")).toBe("https://wa.me/966501234567");
    expect(waLink("+966501234567", "هلا بك")).toBe(`https://wa.me/966501234567?text=${encodeURIComponent("هلا بك")}`);
  });

  it("counts down in hours, minutes and seconds (days when long)", () => {
    expect(countdown(0)).toBe("00:00:00");
    expect(countdown(-5)).toBe("00:00:00");
    expect(countdown(2 * H + 5 * 60_000 + 9000)).toBe("02:05:09");
    expect(countdown(26 * H)).toBe("1 يوم 02:00:00");
  });

  it("knows how to show a reel: a file in a player, YouTube / Instagram / Vimeo in a frame, the rest refused", () => {
    expect(embedOf("https://cdn.x.com/a/b.mp4")).toEqual({ kind: "file", url: "https://cdn.x.com/a/b.mp4" });
    expect(embedOf("https://youtu.be/abc123")).toEqual({ kind: "frame", url: "https://www.youtube.com/embed/abc123?rel=0" });
    expect(embedOf("https://www.youtube.com/watch?v=abc123&t=1")?.url).toBe("https://www.youtube.com/embed/abc123?rel=0");
    expect(embedOf("https://www.youtube.com/shorts/abc123")?.url).toBe("https://www.youtube.com/embed/abc123?rel=0");
    expect(embedOf("https://www.instagram.com/reel/Cxyz_12/?igsh=1")).toEqual({ kind: "frame", url: "https://www.instagram.com/reel/Cxyz_12/embed" });
    expect(embedOf("https://vimeo.com/12345")?.url).toBe("https://player.vimeo.com/video/12345");
    for (const x of ["", "http://youtu.be/abc", "https://evil.com/page", "javascript:alert(1)", "https://www.instagram.com/someone/"]) expect(embedOf(x), x).toBeNull();
  });

  it("the course holds a price for a few hours and a few open orders", () => {
    expect(COURSE.lockMinutes).toBeGreaterThanOrEqual(60);
    expect(COURSE.maxOpen).toBeGreaterThanOrEqual(2);
  });
});
