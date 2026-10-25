import { describe, expect, it } from "vitest";
import { ROBOTS, robotFor } from "@config/jawad/robots";

describe("the robots introducing themselves", () => {
  it("finds the robot of each page", () => {
    // the home page has no robot
    expect(robotFor("/jawad-ai")).toBeNull();
    expect(robotFor("/jawad-ai/images")?.name).toBe("جواد");
    expect(robotFor("/jawad-ai/film/abc/sheets")?.name).toBe("سجاد");
    expect(robotFor("/jawad-ai/editor/123")?.name).toBe("حيدرة");
    expect(robotFor("/jawad-ai/student")?.name).toBe("صادق");
    expect(robotFor("/jawad-ai/games")?.name).toBe("قنبر");
    expect(robotFor("/jawad-ai/booklet/x/upload")?.name).toBe("عباس وزينب");
    expect(robotFor("/jawad-ai/coins")).toBeNull();
    expect(robotFor("/jawad-ai/admin/stats")).toBeNull();
  });

  it("every robot says who it is, what it does and how to start", () => {
    for (const r of Object.values(ROBOTS)) {
      expect(r.name, r.id).toBeTruthy();
      expect(r.does.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.start.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.tint, r.id).toHaveLength(2);
    }
  });
});
