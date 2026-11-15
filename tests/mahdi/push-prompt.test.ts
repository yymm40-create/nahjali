import { describe, expect, it } from "vitest";
import { laterStillOn } from "@/components/mahdi/PushPrompt";

describe("«فعّل التنبيهات» on the home", () => {
  const now = Date.parse("2026-11-13T12:00:00Z");
  it("stays away for 3 days after «لاحقًا», then asks again", () => {
    expect(laterStillOn(String(now - 86_400_000), now)).toBe(true);
    expect(laterStillOn(String(now - 4 * 86_400_000), now)).toBe(false);
  });
  it("asks when nothing was ever saved or the value is broken", () => {
    expect(laterStillOn(null, now)).toBe(false);
    expect(laterStillOn("x", now)).toBe(false);
  });
});
