import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { prayerMinutes } from "@/lib/mahdi/engine";
import { alertUrl, answeredOffer, clock12, offerSettings, prayerSlots, shouldOffer } from "@/lib/mahdi/remind-offer";
import { safeAlertPath } from "@/lib/mahdi/client/native";

const read = (p: string) => readFileSync(p, "utf8");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

describe("«أذكّرك بكرة؟»: asking for notifications once, at the right time", () => {
  it("never on entry: only after something is finished while the app is open, on a device that can still ask", () => {
    expect(shouldOffer({ device: "off", answered: false, doneAtOpen: 0, doneNow: 0 })).toBe(false);
    expect(shouldOffer({ device: "off", answered: false, doneAtOpen: null, doneNow: 3 })).toBe(false);
    expect(shouldOffer({ device: "off", answered: false, doneAtOpen: 2, doneNow: 3 })).toBe(true);
    expect(shouldOffer({ device: "off", answered: true, doneAtOpen: 2, doneNow: 3 })).toBe(false);
    for (const d of ["on", "denied", "unsupported", "needs-install", "not-configured", "checking"]) expect(shouldOffer({ device: d, answered: false, doneAtOpen: 0, doneNow: 1 })).toBe(false);
    expect(answeredOffer(null)).toBe(false);
    expect(answeredOffer("no:1")).toBe(true);
  });

  it("offers times tied to the prayers (half an hour after, to 5 minutes)", () => {
    const s = prayerSlots({ fajr: 5 * 60 + 6, dhuhr: 11 * 60 + 40, maghrib: 17 * 60 + 18 });
    expect(s.map((x) => [x.label, x.at])).toEqual([
      ["بعد الفجر", "05:35"],
      ["بعد الظهر", "12:10"],
      ["بعد المغرب", "17:50"],
    ]);
    expect(prayerSlots({ fajr: null, dhuhr: null, maghrib: null }).map((x) => x.at)).toEqual(["05:30", "12:30", "18:30"]);
    expect(clock12("17:50")).toBe("5:50 م");
    expect(clock12("05:35")).toBe("5:35 ص");
  });

  it("works out Dhuhr and Maghrib (Ja'fari, 4°) beside Fajr", () => {
    const p = prayerMinutes("Asia/Riyadh", "2026-11-26", null);
    expect(p.dhuhr).toBeGreaterThan(11 * 60 + 30);
    expect(p.dhuhr).toBeLessThan(11 * 60 + 50);
    expect(p.maghrib).toBeGreaterThan(17 * 60 + 10);
    expect(p.maghrib).toBeLessThan(17 * 60 + 30);
    expect(p.fajr).toBeLessThan(p.dhuhr!);
  });

  it("«إيه» saves one reminder a day at that time, out of the quiet hours", () => {
    const saved = { mode: "every_6h", times: ["08:00"], quietStart: "23:00", quietEnd: "07:00", habitReminders: true };
    expect(offerSettings(saved, "17:50")).toEqual({ ...saved, mode: "daily", times: ["17:50"] });
    expect(offerSettings(saved, "05:35")).toEqual({ ...saved, mode: "daily", times: ["05:35"], quietEnd: "05:35" });
  });

  it("a reminder opens the thing itself, never a page outside the app", () => {
    expect(alertUrl("habit", { id: "h1" })).toBe("/mahdi/habits/h1");
    expect(alertUrl("task", { date: "2026-11-26" })).toBe("/mahdi/day/2026-11-26");
    expect(alertUrl("day")).toBe("/mahdi");
    expect(safeAlertPath("/mahdi/habits/h1")).toBe("/mahdi/habits/h1");
    expect(safeAlertPath("https://evil.example")).toBe("/mahdi");
    expect(safeAlertPath("//evil.example/mahdi")).toBe("/mahdi");
    expect(safeAlertPath(undefined)).toBe("/mahdi");
  });

  it("only «أذكّرك بكرة؟» and the «هالجوال» switch ask; the home card is gone and the bell never asks", () => {
    expect(existsSync("src/components/mahdi/PushPrompt.tsx")).toBe(false);
    expect(read("src/components/mahdi/HomeBoard.tsx")).not.toContain("PushPrompt");
    expect(read("src/components/mahdi/AlertBell.tsx")).not.toContain("enablePush");
    // DayTasks only re-sends a subscription a device already has
    expect(read("src/components/mahdi/DayTasks.tsx")).not.toMatch(/device === "off"[^\n]*enablePush/);
    const askers = walk("src")
      .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith("client/push.ts"))
      .filter((f) => /\benablePush\(/.test(read(f)))
      .sort();
    expect(askers).toEqual(["src/app/mahdi/(app)/more/notifications/page.tsx", "src/components/mahdi/DayTasks.tsx", "src/components/mahdi/ReminderOffer.tsx"]);
    expect(read("src/app/mahdi/(app)/layout.tsx")).toContain("<ReminderOffer />");
  });

  it("«التذكير» has one bell and «هالجوال» with one switch at its top", () => {
    const page = read("src/app/mahdi/(app)/more/notifications/page.tsx");
    expect(page.match(/name="bell"/g)?.length).toBe(1);
    expect(page.indexOf("t.notify.phone}")).toBeLessThan(page.indexOf("onSubmit={save}"));
    expect(page).toMatch(/role="switch"[\s\S]*checked=\{device === "on"\}/);
  });

  it("no message about a broken streak, ever", () => {
    for (const f of walk("src/lib/mahdi").concat(walk("src/components/mahdi"))) expect(read(f)).not.toMatch(/انكسرت سلسلتك|سلسلتك في خطر|تنقطع سلسلتك/);
  });

  it("the phone app opens a reminder's own screen and refreshes when it comes back", () => {
    const native = read("src/components/mahdi/NativeAlerts.tsx");
    expect(native).toContain("onAlertTap(");
    expect(native).toContain("visibilitychange");
    expect(native).not.toMatch(/extra: \{ url: "\/mahdi" \}/);
  });
});
