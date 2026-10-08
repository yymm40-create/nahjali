import { describe, expect, it } from "vitest";
import { newer, outdatedApp } from "@/components/AppUpdate";
import { DESKTOP_LATEST, MOBILE_LATEST } from "@config/downloads";

describe("the «نسخة جديدة» notice in the apps", () => {
  it("compares versions", () => {
    expect(newer("1.2.2", "1.2.1")).toBe(true);
    expect(newer("1.2.2", "1.2.2")).toBe(false);
    expect(newer("1.1", "1.0")).toBe(true);
    expect(newer("1.2.0", "0")).toBe(true);
  });

  it("tells an older desktop program or phone app, never the newest one or a browser", () => {
    expect(outdatedApp({ haidaraDesktop: { version: "1.2.1" } }, "")).toBe("desktop");
    expect(outdatedApp({ haidaraDesktop: {} }, "")).toBe("desktop");
    expect(outdatedApp({ haidaraDesktop: { version: DESKTOP_LATEST } }, "")).toBeNull();
    expect(outdatedApp({}, "Mozilla/5.0 (Linux; Android 14) Chrome/140 Mobile Safari/537.36 NahjAliApp/1.0")).toBe("phone");
    expect(outdatedApp({}, `Mozilla/5.0 Safari/604.1 NahjAliApp/${MOBILE_LATEST}`)).toBeNull();
    expect(outdatedApp({}, "Mozilla/5.0 (Macintosh) Safari/605.1.15")).toBeNull();
  });
});
