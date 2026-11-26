import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parentOf, tabOf, titleOf } from "@/components/mahdi/nav";
import { DEFAULT_PROFILE, makePlan } from "@/lib/mahdi/health/plan";
import { FOOD_STEPS, HEALTH_VIEWS, coachScreen, healthViewOf, parseDay, parseIndex, parseSession, resolveSetup, setupHref, withParams } from "@/lib/mahdi/health/route";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const exists = (p: string) => existsSync(new URL(`../../${p}`, import.meta.url));

describe("«الصحة العلوية» in the app's own frame (phase 7)", () => {
  it("lives in the (app) group: no dark shell of its own, no second bar", () => {
    expect(exists("src/app/mahdi/(gym)/layout.tsx")).toBe(false);
    for (const p of ["", "/plan", "/progress", "/learn", "/learn/[id]", "/setup", "/habits", "/research"]) expect(exists(`src/app/mahdi/(app)/health${p}/page.tsx`), p).toBe(true);
    const frame = read("src/components/mahdi/health/HealthFrame.tsx");
    expect(frame).not.toContain("gym-tabs");
    expect(frame).not.toContain("لأجل المهدي</");
    const css = read("src/components/mahdi/health/health.css");
    for (const gone of [".gym-app", ".gym-tabs", ".gym-top", "#0c0e11", "#c6ff1a", "#15181d"]) expect(css, gone).not.toContain(gone);
    // colours only from the person's design
    expect(css.replace(/rgba\(20, 33, 61, 0\.35\)/, "")).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(/i);
  });

  it("is under «عاداتي», with a title on each inner screen and the way back", () => {
    for (const p of ["/mahdi/health", "/mahdi/health/plan", "/mahdi/health/setup", "/mahdi/health/learn/bench"]) expect(tabOf(p)?.href).toBe("/mahdi/projects");
    expect(titleOf("/mahdi/health")).toBe("الصحة العلوية");
    expect(titleOf("/mahdi/health/progress")).toBe("الصحة العلوية");
    expect(titleOf("/mahdi/health/setup")).toBe("خطة جديدة");
    expect(titleOf("/mahdi/health/research")).toBe("البحث والمصادر");
    expect(parentOf("/mahdi/health/learn/bench")).toBe("/mahdi/health/learn");
    expect(parentOf("/mahdi/health/setup")).toBe("/mahdi/health");
  });

  it("shows its four views on their own pages only", () => {
    expect(HEALTH_VIEWS.map((v) => v.href)).toEqual(["/mahdi/health", "/mahdi/health/plan", "/mahdi/health/progress", "/mahdi/health/learn"]);
    expect(healthViewOf("/mahdi/health/progress")?.label).toBe("التقدم");
    for (const p of ["/mahdi/health/setup", "/mahdi/health/habits", "/mahdi/health/learn/bench", "/mahdi/health/research"]) expect(healthViewOf(p), p).toBeNull();
  });
});

describe("«الصحة العلوية»: every step in the link", () => {
  const both = makePlan({ ...DEFAULT_PROFILE, track: "both" }, "steps");
  const gymOnly = makePlan({ ...DEFAULT_PROFILE, track: "gym" }, "steps");

  it("writes each setup step as a link", () => {
    expect(setupHref()).toBe("/mahdi/health/setup");
    expect(setupHref("goal")).toBe("/mahdi/health/setup?step=goal");
    expect(setupHref("build-day", 2)).toBe("/mahdi/health/setup?step=build-day&i=2");
    expect(setupHref("build-food", 0)).toBe("/mahdi/health/setup?step=build-food");
    expect(setupHref("about", 3)).toBe("/mahdi/health/setup?step=about");
  });

  it("opens the same step from the link, and a builder only with its plan", () => {
    expect(resolveSetup(null, null, null)).toEqual({ step: "track", i: 0 });
    expect(resolveSetup("train", "4", null)).toEqual({ step: "train", i: 0 });
    expect(resolveSetup("nonsense", null, both)).toEqual({ step: "track", i: 0 });
    expect(resolveSetup("build-food", "3", both)).toEqual({ step: "build-food", i: 3 });
    expect(resolveSetup("build-food", "99", both)).toEqual({ step: "build-food", i: FOOD_STEPS.length - 1 });
    expect(resolveSetup("build-food", "1", gymOnly)).toEqual({ step: "mode", i: 0 });
    expect(resolveSetup("build-food", "1", null)).toEqual({ step: "mode", i: 0 });
    const days = both.workout!.days.length;
    expect(resolveSetup("build-day", String(days + 5), both)).toEqual({ step: "build-day", i: days - 1 });
    expect(resolveSetup("build-day", "-1", both)).toEqual({ step: "build-day", i: 0 });
    expect(resolveSetup("build-day", "1", null)).toEqual({ step: "mode", i: 0 });
  });

  it("reads numbers, days and sessions from the link safely", () => {
    expect(parseIndex("2", 4)).toBe(2);
    expect(parseIndex("x", 4)).toBe(0);
    expect(parseIndex("1e3", 4)).toBe(0);
    expect(parseDay("2026-11-24", "2026-11-26")).toBe("2026-11-24");
    expect(parseDay("2026-02-30", "2026-11-26")).toBe("2026-11-26");
    expect(parseDay("yesterday", "2026-11-26")).toBe("2026-11-26");
    expect(parseDay(null, "2026-11-26")).toBe("2026-11-26");
    expect(parseSession("3", [1, 3, 5])).toBe(3);
    expect(parseSession("0", [0, 2])).toBe(0);
    expect(parseSession("4", [1, 3, 5])).toBeNull();
    expect(parseSession("12", [1])).toBeNull();
  });

  it("changes one view of the link and keeps the others", () => {
    expect(withParams("/mahdi/health", "", { date: "2026-11-24" })).toBe("/mahdi/health?date=2026-11-24");
    expect(withParams("/mahdi/health", "date=2026-11-24&edit=1", { edit: false })).toBe("/mahdi/health?date=2026-11-24");
    expect(withParams("/mahdi/health", "date=2026-11-24&session=3", { date: null, session: null })).toBe("/mahdi/health");
    expect(withParams("/mahdi/health/plan", "", { edit: true })).toBe("/mahdi/health/plan?edit=1");
    expect(withParams("/mahdi/health", "", { session: 0 })).toBe("/mahdi/health?session=0");
  });

  it("tells عباس the step from the link", () => {
    expect(coachScreen("/mahdi/health/setup", "goal")).toBe("goal");
    expect(coachScreen("/mahdi/health/setup", null)).toBe("track");
    expect(coachScreen("/mahdi/health/setup", "bad")).toBe("track");
    expect(coachScreen("/mahdi/health", "goal")).toBe("today");
    expect(coachScreen("/mahdi/health/learn/bench", null)).toBe("learn");
  });
});
