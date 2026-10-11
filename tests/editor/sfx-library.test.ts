import { describe, expect, it } from "vitest";
import { SFX_CATEGORIES, SFX_LIBRARY, sfxById, sfxCostUsd, sfxPath } from "@config/jawad/sfx-library";

describe("«مكتبة المؤثرات» of «حيدرة كت»", () => {
  it("has a couple of hundred effects, each in a known section with a unique id", () => {
    expect(SFX_LIBRARY.length).toBeGreaterThanOrEqual(200);
    expect(new Set(SFX_LIBRARY.map((s) => s.id)).size).toBe(SFX_LIBRARY.length);
    const cats = new Set(SFX_CATEGORIES.map((c) => c.id));
    for (const s of SFX_LIBRARY) {
      expect(cats.has(s.cat), s.id).toBe(true);
      expect(s.id, s.id).toMatch(/^[a-z0-9-]+$/);
      expect(s.name.length, s.id).toBeGreaterThan(1);
      expect(s.prompt.length, s.id).toBeGreaterThan(8);
      // the generator makes 0.5–30 s
      expect(s.seconds, s.id).toBeGreaterThan(0);
      expect(s.seconds, s.id).toBeLessThanOrEqual(30);
    }
    for (const c of SFX_CATEGORIES) expect(SFX_LIBRARY.filter((s) => s.cat === c.id).length, c.id).toBeGreaterThanOrEqual(10);
  });

  it("covers what reels, comedy and horror reach for most", () => {
    for (const id of ["transition-whoosh-fast", "riser-riser-long", "hit-boom-meme", "comedy-rimshot", "comedy-record-scratch", "comedy-sad-trombone", "horror-jumpscare", "ui-pop", "crowd-applause", "ambience-rain"]) expect(sfxById(id), id).toBeTruthy();
  });

  it("is stored under one folder, and costs about a dollar or two to make once", () => {
    expect(sfxPath("ui-pop")).toBe("_library/sfx/ui-pop.mp3");
    const usd = sfxCostUsd(SFX_LIBRARY);
    expect(usd).toBeGreaterThan(0.5);
    expect(usd).toBeLessThan(3);
  });
});
