import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { deviceOf, playSource, statsOf, PLAYS, type PlayRow } from "@/lib/games/plays-shared";

describe("game counter · where a player came from", () => {
  it("the link's own word wins", () => {
    expect(playSource({ search: "?ref=wa", referrer: "https://instagram.com/" })).toBe("whatsapp");
    expect(playSource({ search: "?utm_source=Instagram" })).toBe("instagram");
    expect(playSource({ search: "?ref=school" })).toBe("school");
  });
  it("the app it was opened in", () => {
    expect(playSource({ ua: "Mozilla/5.0 (iPhone) Instagram 300.0" })).toBe("instagram");
    expect(playSource({ ua: "Mozilla/5.0 Snapchat/12.0" })).toBe("snapchat");
    expect(playSource({ ua: "Mozilla/5.0 musical_ly_2023" })).toBe("tiktok");
    expect(playSource({ ua: "Mozilla/5.0 [FBAN/FBIOS;FBAV/400]" })).toBe("facebook");
  });
  it("the page before, the site itself, or nothing", () => {
    expect(playSource({ referrer: "https://web.whatsapp.com/" })).toBe("whatsapp");
    expect(playSource({ referrer: "https://t.co/abc" })).toBe("x");
    expect(playSource({ referrer: "https://www.google.com.sa/" })).toBe("google");
    expect(playSource({ referrer: "https://www.aljawadai.app/jawad-ai/games", host: "aljawadai.app" })).toBe("site");
    expect(playSource({ referrer: "https://blog.example.org/post" })).toBe("blog.example.org");
    expect(playSource({ referrer: "" })).toBe("direct");
    expect(playSource({ referrer: "not a url" })).toBe("direct");
  });
});

describe("game counter · device", () => {
  it("phone, tablet, desktop", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile")).toBe("phone");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-S918B) Mobile")).toBe("phone");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 13; SM-X700)")).toBe("tablet");
    expect(deviceOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("desktop");
    expect(deviceOf("")).toBe("");
  });
});

describe("game counter · the numbers", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const row = (visitor: string, at: string, seconds: number, source = "whatsapp", user: string | null = null, device = "phone"): PlayRow => ({ visitor, user_id: user, source, device, seconds, started_at: at });
  const rows = [
    row("aaaaaaaa", "2026-10-19T10:00:00Z", 300),
    row("aaaaaaaa", "2026-10-18T10:00:00Z", 120, "instagram"),
    row("bbbbbbbb", "2026-10-19T09:00:00Z", 60, "whatsapp", "u1"),
    row("cccccccc", "2026-10-10T09:00:00Z", 999_999, "direct", null, "desktop"),
    row("dddddddd", "2026-01-01T09:00:00Z", 30, ""),
  ];
  const s = statsOf(rows, now);
  it("opens, players, returning, signed in", () => {
    expect(s.opens).toBe(5);
    expect(s.players).toBe(4);
    expect(s.returning).toBe(1);
    expect(s.signedIn).toBe(1);
  });
  it("one sitting counts at most its cap; minutes and average", () => {
    const secs = 300 + 120 + 60 + PLAYS.maxSeconds + 30;
    expect(s.minutes).toBeCloseTo(secs / 60, 0);
    expect(s.avgMinutes).toBeCloseTo(secs / 5 / 60, 0);
  });
  it("the last 14 days, oldest first, today last; old plays outside the chart", () => {
    expect(s.days).toHaveLength(PLAYS.days);
    expect(s.days.at(-1)).toEqual({ day: "2026-10-19", opens: 2, players: 2 });
    expect(s.days.at(-2)).toEqual({ day: "2026-10-18", opens: 1, players: 1 });
    expect(s.days.reduce((n, d) => n + d.opens, 0)).toBe(4);
    expect(s.today).toBe(2);
  });
  it("sources most first, with Arabic names; an empty source is a direct link", () => {
    expect(s.sources[0]).toEqual({ source: "whatsapp", label: "واتساب", opens: 2 });
    expect(s.sources.find((x) => x.source === "direct")?.opens).toBe(2);
    expect(s.devices[0]).toEqual({ device: "phone", opens: 4 });
    expect(s.lastPlayed).toBe("2026-10-19T10:00:00Z");
  });
  it("nothing played: zeros, no division by zero", () => {
    const e = statsOf([], now);
    expect(e.opens).toBe(0);
    expect(e.avgMinutes).toBe(0);
    expect(e.lastPlayed).toBeNull();
  });
});

describe("game counter · wiring", () => {
  it("the table is server-only and the play page counts", () => {
    const sql = readFileSync("supabase/migrations/0082_game_plays.sql", "utf8");
    expect(sql).toMatch(/revoke all on public\.game_plays from anon, authenticated/);
    expect(readFileSync("src/components/jawad/games/PlayFrame.tsx", "utf8")).toMatch(/\/visit`/);
    expect(readFileSync("src/lib/games/plays.ts", "utf8")).toMatch(/game\.user_id === userId\) return null/);
  });
});
