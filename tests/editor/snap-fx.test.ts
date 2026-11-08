import { describe, expect, it } from "vitest";
import { ANIMS, animAt, readTimeline } from "@/lib/editor/model";
import { motionLabel, newMotion, readMotion } from "@/lib/editor/motion-elements";
import { COMMANDS_GUIDE } from "@/lib/editor/assistant-commands";

describe("«فيلم الصرقعة» additions to Haidara", () => {
  it("has the «حرف حرف» text entrance", () => {
    expect(ANIMS.letters).toMatchObject({ label: "حرف حرف", only: "text" });
  });

  it("keeps a horizontal gradient and drops an unknown direction", () => {
    const base = { version: 1, tracks: [{ id: "t1", kind: "text", name: "ك", clips: [{ id: "c1", start: 0, in: 0, out: 1000, text: { body: "GEMINI", grad: "#ff7e9a", gradDir: "h" } }] }] };
    const tl = readTimeline(base);
    const text = tl?.tracks.flatMap((t) => t.clips).find((c) => c.text)?.text;
    expect(text?.gradDir).toBe("h");
    const bad = readTimeline({ ...base, tracks: [{ ...base.tracks[0], clips: [{ ...base.tracks[0].clips[0], text: { body: "x", grad: "#ffffff", gradDir: "diag" } }] }] });
    expect(bad?.tracks.flatMap((t) => t.clips).find((c) => c.text)?.text?.gradDir).toBeUndefined();
  });

  it("the sticker and the burst are motion elements", () => {
    const chip = newMotion("chip");
    expect(chip.title).toBeTruthy();
    expect(chip.sub).toContain("←");
    expect(readMotion({ kind: "burst" })).not.toBeNull();
    expect(motionLabel(newMotion("burst"))).toContain("انفجار ذهبي");
  });

  it("the assistant knows them", () => {
    expect(COMMANDS_GUIDE).toContain('"burst"');
    expect(COMMANDS_GUIDE).toContain('"letters"');
    expect(COMMANDS_GUIDE).toContain("gradDir");
  });

  it("animAt drives letters from 0 to 1 over the entrance", () => {
    const clip = { anim: { in: "letters" as const, out: null, inMs: 900, outMs: 400 }, start: 0, in: 0, out: 3000, speed: 1 };
    expect(animAt(clip, 0).letters).toBe(0);
    const mid = animAt(clip, 450).letters!;
    expect(mid).toBeGreaterThan(0.3);
    expect(mid).toBeLessThan(0.7);
    expect(animAt(clip, 2000).letters).toBeNull();
  });
});
