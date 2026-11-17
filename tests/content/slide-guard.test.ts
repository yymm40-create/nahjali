import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { loudnessDb, slideProblem } from "@/components/claude-code/check-video";

// «لازم نمنع هالأخطاء تصير للعملاء» (the owner, 17 Nov 2026): every finished slide is checked in the browser before it is
// shown, and the reel never joins a slide whose sound it could not read.
describe("the check of a finished slide", () => {
  const ok = { n: 1, seconds: 10.6, wantSeconds: 10.6, wantSound: true, soundDb: -17 };
  it("passes a slide of the right length that carries the person's sound", () => {
    expect(slideProblem(ok)).toBeNull();
    // a slide of library effects only may be quiet
    expect(slideProblem({ ...ok, wantSound: false, soundDb: null })).toBeNull();
  });
  it("stops a silent slide over the person's sound (slide 1 of 17 Nov), an empty one, and one of the wrong length", () => {
    expect(slideProblem({ ...ok, soundDb: -91 })).toContain("بدون صوت");
    expect(slideProblem({ ...ok, soundDb: null })).toContain("بدون صوت");
    expect(slideProblem({ ...ok, seconds: 0 })).toContain("فاضي");
    expect(slideProblem({ ...ok, seconds: 6 })).toContain("طوله");
    expect(slideProblem({ ...ok, seconds: 10.9 })).toBeNull();
  });
  it("measures loudness: silence is far below the line, a voice far above", () => {
    expect(loudnessDb(new Float32Array(4800))).toBeLessThan(-100);
    const voice = Float32Array.from({ length: 48000 }, (_, i) => 0.14 * Math.sin(i / 7));
    expect(loudnessDb(voice)).toBeGreaterThan(-25);
  });
  it("runs on every motion slide before it is returned, and the reel refuses a slide whose sound it can't read", () => {
    const draw = readFileSync("src/components/claude-code/draw.ts", "utf8");
    expect(draw).toContain("await checkSlideVideo(video, { n: m.n, wantSeconds: length, wantSound: !!m.voice });");
    const reel = readFileSync("src/components/jawad/content/slides-reel.ts", "utf8");
    expect(reel).toContain("await soundOf(s.video, frames / FPS, hasSound, k + 1)");
    expect(reel).not.toContain("} catch {\n    // a slide without a sound track stays silent");
  });
  it("the reel's empty bands are a simple background in the slide's own colours, not a dark blurred copy", () => {
    const reel = readFileSync("src/components/jawad/content/slides-reel.ts", "utf8");
    expect(reel).toContain("edges ??= edgesOf(");
    expect(reel).not.toContain('ctx.filter = "blur(48px) brightness(0.45)"');
  });
});
