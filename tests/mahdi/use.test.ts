import { describe, expect, it } from "vitest";
import { localDay, plausibleDay, areaOf } from "@/lib/mahdi/use";

describe("usage sections", () => {
  it("names the section of a path", () => {
    expect(areaOf("/mahdi")).toBe("home");
    expect(areaOf("/mahdi/")).toBe("home");
    expect(areaOf("/mahdi/reading/guide")).toBe("reading");
    expect(areaOf("/mahdi/health/plan")).toBe("health");
    expect(areaOf("/jawad-ai")).toBeNull();
    expect(areaOf("/mahdi/%D8%A7")).toBeNull();
  });
  it("accepts a device day only near the server's day", () => {
    const now = new Date("2026-11-12T10:00:00Z");
    expect(plausibleDay("2026-11-12", now)).toBe(true);
    expect(plausibleDay("2026-11-13", now)).toBe(true);
    expect(plausibleDay("2026-11-11", now)).toBe(true);
    expect(plausibleDay("2026-11-15", now)).toBe(false);
    expect(plausibleDay("12/11/2026", now)).toBe(false);
    expect(localDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
