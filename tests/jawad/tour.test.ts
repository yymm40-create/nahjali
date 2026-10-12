import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOUR_PATHS, TOUR_TRY, tourProgress } from "@config/jawad/tour";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

describe("«الجولة التعريفية»", () => {
  it("teaches the two paths, with a picture for every step", () => {
    expect(TOUR_PATHS.map((p) => p.id)).toEqual(["studio", "film"]);
    expect(TOUR_PATHS[1].steps).toHaveLength(7);
    for (const st of TOUR_PATHS.flatMap((p) => p.steps)) expect(() => readFileSync(new URL(`../../public${st.image}`, import.meta.url))).not.toThrow();
    expect(TOUR_TRY.examples.length).toBeGreaterThanOrEqual(3);
  });
  it("the ring fills only when the chosen path is done", () => {
    expect(tourProgress([], null)).toBe(0);
    const all = ["welcome", "ask", "try", "path", ...TOUR_PATHS[1].steps.map((s) => s.id)];
    expect(tourProgress(all, "film")).toBe(1);
    expect(tourProgress(all, "studio")).toBeLessThan(1);
  });
  it("the free image is once per account and given back when it fails; the ring is in the header", () => {
    const route = read("src/app/api/jawad/tour/try/route.ts");
    expect(route).toContain("tour-try:");
    expect(route).toContain('resolution: "std"');
    expect(route).toContain(".delete()");
    expect(read("src/components/jawad/JawadHeader.tsx")).toContain("<Tour userId={user.id} />");
  });
});
