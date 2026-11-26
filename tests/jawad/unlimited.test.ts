import { describe, expect, it } from "vitest";
import { generatorById } from "@config/jawad/generators";
import { UNLIMITED, UNLIMITED_PASSES, fastUnits, holdFor, passCovers, passPrice, unlimitedPhase, unlimitedStart, unlimitedEnd } from "@config/jawad/unlimited";

describe("«لامحدود» passes", () => {
  it("every pass is a real generator of its kind, and every value it requires is one of that generator's choices", () => {
    for (const p of UNLIMITED_PASSES) {
      const def = generatorById(p.generatorId);
      expect(def, p.key).toBeTruthy();
      expect(def!.output, p.key).toBe(p.kind);
      for (const [key, allowed] of Object.entries(p.match)) {
        const o = def!.options.find((x) => x.key === key);
        expect(o, `${p.key}.${key}`).toBeTruthy();
        if (o?.kind === "choice") for (const v of allowed) expect(o.values.map((x) => x.value), `${p.key}.${key}=${v}`).toContain(v);
      }
    }
  });

  it("keys are unique and one best per kind", () => {
    expect(new Set(UNLIMITED_PASSES.map((p) => p.key)).size).toBe(UNLIMITED_PASSES.length);
    expect(UNLIMITED_PASSES.filter((p) => p.kind === "video" && p.best)).toHaveLength(1);
    expect(UNLIMITED_PASSES.filter((p) => p.kind === "image" && p.best)).toHaveLength(1);
  });

  it("12 hours is half the price, rounded up; pictures start at 19", () => {
    const p = UNLIMITED_PASSES.find((x) => x.key === "seedance25-480")!;
    expect(passPrice(p, 24)).toBe(109);
    expect(passPrice(p, 12)).toBe(55);
    expect(Math.min(...UNLIMITED_PASSES.map((x) => x.price24))).toBe(19);
  });

  it("covers only its generator, its quality and videos up to 15 seconds", () => {
    const p = UNLIMITED_PASSES.find((x) => x.key === "seedance25-720")!;
    expect(passCovers(p, "byteplus-seedance-2-5", { resolution: "720p", duration: 15 })).toBe(true);
    expect(passCovers(p, "byteplus-seedance-2-5", { resolution: "480p", duration: 10 })).toBe(false);
    expect(passCovers(p, "byteplus-seedance-2-5", { resolution: "720p", duration: 16 })).toBe(false);
    expect(passCovers(p, "byteplus-seedance-2-0", { resolution: "720p", duration: 5 })).toBe(false);
    const rf = UNLIMITED_PASSES.find((x) => x.key === "realface20-480")!;
    expect(passCovers(rf, "seedance-real-face", { version: "2.5", resolution: "480p", duration: 5 })).toBe(false);
    expect(passCovers(rf, "seedance-real-face", { version: "2.0", resolution: "480p", duration: 5 })).toBe(true);
  });

  it("the waits grow and then stay, and the fast balance counts seconds or pictures", () => {
    expect([0, 1, 2, 3, 4, 9].map((n) => holdFor("video", n) / 60_000)).toEqual([10, 15, 20, 25, 25, 25]);
    expect([0, 1, 2, 3, 7].map((n) => holdFor("image", n) / 60_000)).toEqual([3, 6, 9, 12, 12]);
    expect(fastUnits("video", { duration: 12 })).toBe(12);
    expect(fastUnits("image", { count: 3 })).toBe(3);
    expect(UNLIMITED.fast).toEqual({ video: 130, image: 20 });
  });

  it("is on sale for 72 hours", () => {
    expect(unlimitedEnd() - unlimitedStart()).toBe(72 * 3600_000);
    expect(unlimitedPhase(unlimitedStart() - 1)).toBe("before");
    expect(unlimitedPhase(unlimitedStart())).toBe("open");
    expect(unlimitedPhase(unlimitedEnd())).toBe("over");
  });
});

describe("«لامحدود» puts a request on the pass's quality", () => {
  it("the pass's first values make an off-quality request fit, a too-long video does not", () => {
    const p = UNLIMITED_PASSES.find((x) => x.key === "wan30-480")!;
    const patch = Object.fromEntries(Object.entries(p.match).map(([k, v]) => [k, v[0]]));
    expect(passCovers(p, "wan-3-0", { resolution: "720p", duration: 5 })).toBe(false);
    expect(passCovers(p, "wan-3-0", { resolution: "720p", duration: 5, ...patch })).toBe(true);
    expect(passCovers(p, "wan-3-0", { resolution: "720p", duration: 20, ...patch })).toBe(false);
  });
});
