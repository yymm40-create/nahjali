import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMEBACK_AFTER_DAYS, ENGAGE, ENGAGE_DAILY_MAX, ENGAGE_KINDS, engageDay, engageOn, engageText, parseEngage, weekEndsOn, weekStartOf } from "@/lib/mahdi/engage";
import { hintWeek } from "@/components/mahdi/ReviewHints";
import { inQuietHours, toMinutes } from "@/lib/mahdi/engine";

// «تنبيهات تجيبك للتطبيق» and the home's «اكتب ملاحظتك» cards: what is sent, when, to whom, and how a person puts them off.

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("the kinds", () => {
  it("are the five, each with its own hour that is never inside the default quiet hours (23:00 → 07:00)", () => {
    expect(ENGAGE.map((e) => e.id).sort()).toEqual([...ENGAGE_KINDS].sort());
    for (const e of ENGAGE) expect(inQuietHours(toMinutes(e.at)!, "23:00", "07:00"), e.id).toBe(false);
    expect(new Set(ENGAGE.map((e) => e.priority)).size).toBe(ENGAGE.length);
    expect(ENGAGE_DAILY_MAX).toBe(2);
  });

  it("every kind is on until the person switches it off, and only the switched-off ones are kept", () => {
    expect(engageOn({}, "morning")).toBe(true);
    expect(engageOn(undefined, "streak")).toBe(true);
    expect(engageOn({ streak: false }, "streak")).toBe(false);
    expect(parseEngage({ morning: false, streak: true, bogus: false, comeback: "no" })).toEqual({ morning: false });
    expect(parseEngage("x")).toEqual({});
  });
});

describe("the days", () => {
  it("the week's note is for the week's last day only (a week that starts on Saturday ends on Friday)", () => {
    expect(weekEndsOn(6)).toBe(5);
    expect(weekEndsOn(0)).toBe(6);
    expect(engageDay("review_week", "2026-10-30", 6)).toBe(true); // a Friday
    expect(engageDay("review_week", "2026-10-29", 6)).toBe(false);
    expect(weekStartOf("2026-10-30", 6)).toBe("2026-10-24");
    expect(weekStartOf("2026-10-31", 6)).toBe("2026-10-31");
  });

  it("the morning verse is sent only for a day whose verse has arrived", () => {
    expect(engageDay("morning", "2026-10-25", 6)).toBe(true);
    expect(engageDay("morning", "2027-03-01", 6)).toBe(false);
    expect(engageDay("streak", "2027-03-01", 6)).toBe(true);
  });

  it("the home's week card: the last evening of the week, and the day after for the week that ended", () => {
    expect(hintWeek("2026-10-30", 6, 20)).toBe("2026-10-24"); // Friday evening: this week
    expect(hintWeek("2026-10-30", 6, 10)).toBeNull(); // Friday morning: too early
    expect(hintWeek("2026-10-31", 6, 9)).toBe("2026-10-24"); // Saturday: last week's
    expect(hintWeek("2026-10-28", 6, 20)).toBeNull();
  });
});

describe("the texts", () => {
  it("say what they are for, with a link inside the app", () => {
    const m = engageText("morning", "2026-10-25");
    expect(m.title).toContain("آية اليوم");
    expect(m.body).toContain("وَٱعۡبُدۡ"); // the day's verse itself
    expect(engageText("morning", "2026-10-30").title).toContain("جمعة");
    expect(engageText("review_day", "2026-10-28").url).toBe("/mahdi/day/2026-10-28");
    expect(engageText("review_week", "2026-10-30").url).toMatch(/^\/mahdi\/progress\/week/);
    expect(engageText("streak", "2026-10-28", { n: 9, left: 1 }).body).toMatch(/9 يوم.*عادة وحدة/);
    expect(engageText("streak", "2026-10-28", { n: 9, left: 3 }).body).toMatch(/3 عادات/);
    expect(engageText("comeback", "2026-10-28", { n: 5 }).body).toContain("5 أيام");
    expect(COMEBACK_AFTER_DAYS).toBe(3);
    for (const k of ENGAGE_KINDS) {
      const p = engageText(k, "2026-10-28", { n: 4, left: 2 });
      expect(p.url.startsWith("/mahdi")).toBe(true);
      expect(p.tag).toMatch(/^mahdi-/);
    }
  });
});

describe("the dispatcher's wiring", () => {
  it("runs in the 15-minute tick after the reminders and never stops them, and leaves its heartbeat", () => {
    const route = read("src/app/api/mahdi/notifications/dispatch/route.ts");
    expect(route).toMatch(/dispatchEngagement\(db\)\.catch/);
    expect(route.indexOf("dispatchTaskReminders(db)")).toBeLessThan(route.indexOf("dispatchEngagement(db)"));
    expect(route).toMatch(/mahdi_dispatch_runs/);
  });

  it("claims a send in the log BEFORE sending, so two ticks never send twice; nothing runs before migration 0102", () => {
    const src = read("src/lib/mahdi/server/engage.ts");
    expect(src.indexOf('from("mahdi_push_log").insert')).toBeLessThan(src.indexOf("pushToUser("));
    expect(src).toMatch(/if \(error\) return result;/);
    expect(src).toMatch(/ENGAGE_DAILY_MAX - log\.filter/);
    const sql = read("supabase/migrations/0102_mahdi_engage.sql");
    expect(sql).toMatch(/add column if not exists engage jsonb/);
    expect(sql).toMatch(/primary key \(user_id, kind, day\)/);
    expect(sql).toMatch(/revoke all on public\.mahdi_push_log from anon, authenticated/);
    expect(sql).toMatch(/revoke all on public\.mahdi_dispatch_runs from anon, authenticated/);
  });

  it("the settings page has the switches, the card switches and the owner's status; the home has the cards", () => {
    const page = read("src/app/mahdi/(app)/more/notifications/page.tsx");
    expect(page).toMatch(/تنبيهات تجيبك للتطبيق/);
    expect(page).toMatch(/بطاقات التذكير في الرئيسية/);
    expect(page).toMatch(/status\?\.admin && <SystemStatus/);
    expect(read("src/components/mahdi/HomeBoard.tsx")).toMatch(/<ReviewHints \/>/);
    const hints = read("src/components/mahdi/ReviewHints.tsx");
    expect(hints).toMatch(/لا تذكّرني/);
    expect(hints).toMatch(/لاحقًا/);
  });

  it("the status route shows the heartbeat to the owner only", () => {
    const route = read("src/app/api/mahdi/notifications/status/route.ts");
    expect(route).toMatch(/isAdmin\(user\.email\)/);
    expect(route).toMatch(/mahdi_dispatch_runs/);
    expect(route).not.toMatch(/VAPID_PRIVATE_KEY|MAHDI_CRON_SECRET\)\s*[,}]/);
  });
});
