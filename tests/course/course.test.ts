import { describe, expect, it } from "vitest";
import { SHARE } from "@config/share";
import { countdown, DEFAULT_SETTINGS, embedOf, hasLifetimeAccess, offerFor, offersAt, PRODUCT_ACCESS, readSettings, savingPct, cleanPhone, waLink, COURSE, type CourseSettings } from "@config/course";

const H = 3_600_000;
const T0 = Date.parse("2026-10-10T12:00:00Z");
const S: CourseSettings = { ...DEFAULT_SETTINGS, launchAt: new Date(T0).toISOString() };

describe("the one price: the recorded course at 60", () => {
  it("sells only the recorded course, at 60, whatever the clock says", () => {
    for (const now of [T0 - 5 * H, T0, T0 + 30 * H, T0 + 5000 * H]) {
      const o = offersAt(S, now);
      expect(o.phase).toBe("C");
      expect(o.offers.map((x) => [x.product, x.price, x.bonus])).toEqual([["recorded", 60, 0]]);
      expect(o.endsAt).toBeNull();
    }
    expect(offersAt(DEFAULT_SETTINGS, T0).offers).toHaveLength(1);
  });

  it("the live and the whole course are not on sale", () => {
    expect(offerFor(S, "live", T0)).toBeNull();
    expect(offerFor(S, "combo", T0)).toBeNull();
    expect(offerFor(S, "recorded", T0)?.price).toBe(COURSE.price);
    expect(COURSE.price).toBe(60);
    expect(savingPct(offersAt(S, T0).offers[0])).toBe(0);
  });
});

describe("reading the owner's settings", () => {
  it("promises lifetime access only for products that include the recording", () => {
    expect(PRODUCT_ACCESS.live).not.toContain("مدى الحياة");
    expect(hasLifetimeAccess("live")).toBe(false);
    expect(PRODUCT_ACCESS.recorded).toContain("مدى الحياة");
    expect(hasLifetimeAccess("recorded")).toBe(true);
    expect(hasLifetimeAccess("combo")).toBe(true);
  });

  it("repairs the old default that wrongly promised lifetime access for the live course", () => {
    const s = readSettings({ risks: ["الدورة مدى الحياة، مباشرة كانت أو مسجلة", "مجموعة خاصة"] });
    expect(s.risks).toEqual([DEFAULT_SETTINGS.risks[0], "مجموعة خاصة"]);
  });

  it("migrates the former general course copy to the cinematic film course and its dated programme", () => {
    const s = readSettings({
      headline: "اصنع فيلمك الأقوى بأقل الأسعار وأسهل الطرق والتقنيات (وأعلى جودة)",
      subhead: "دورة عملية في ٣ أيام: يومين نمشي فيهم على صناعة الفيلم السينمائي خطوة بخطوة بالجواد الذكي، واليوم الثالث تدريب تسوي فيه فيلمك أنت بنفسك.",
      days: [{ title: "اليوم الأول: صناعة الفيلم السينمائي (١)", points: ["قديم"] }],
    });
    expect(s.headline).toBe(DEFAULT_SETTINGS.headline);
    expect(s.subhead).toBe(DEFAULT_SETTINGS.subhead);
    expect(s.days.map((d) => d.title)).toEqual(DEFAULT_SETTINGS.days.map((d) => d.title));
  });

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

  it("has no WhatsApp group by default (the live course is gone), and only an https link the owner saves is kept", () => {
    expect(DEFAULT_SETTINGS.groupLink).toBe("");
    expect(readSettings({}).groupLink).toBe("");
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

describe("what the course sells", () => {
  it("promises a recorded course about JAWAD AI that the buyer watches in «دوراتي»", () => {
    expect(COURSE.name).toBe("دورة الجواد الذكاء الاصطناعي المسجلة");
    expect(DEFAULT_SETTINGS.headline).toContain("مسجلة");
    expect(DEFAULT_SETTINGS.days.length).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.risks.join(" ")).toContain("دوراتي");
  });

  it("gives way to today's words when storage still holds the old defaults, and keeps the owner's own", () => {
    const old = readSettings({ headline: "تشتغل على الجواد الذكي بثقة في ٣ أيام: تسوي صورك وفيديوهاتك وتصاميمك بنفسك، وتعرف وين تصرف رصيدك", days: [{ title: "اليوم الأول: تعرّف على الجواد", points: ["أ"] }] });
    expect(old.headline).toBe(DEFAULT_SETTINGS.headline);
    expect(old.days).toEqual(DEFAULT_SETTINGS.days);
    const mine = readSettings({ headline: "كلامي أنا", days: [{ title: "يومي", points: ["أ"] }] });
    expect(mine.headline).toBe("كلامي أنا");
    expect(mine.days).toEqual([{ title: "يومي", points: ["أ"] }]);
  });

  it("keeps «انشرنا واربح» stopped", () => {
    expect(SHARE.paused).toBe(true);
  });
});
