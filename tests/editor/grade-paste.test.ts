import { describe, expect, it } from "vitest";
import { allGradeable, gradeable, pasteGradeCommands } from "@/lib/editor/grade-paste";
import { NEUTRAL_GRADE } from "@/lib/editor/grade";
import { applyAll } from "@/lib/editor/commands";
import type { Clip, Timeline, Track } from "@/lib/editor/model";

const clip = (id: string, start: number, extra: Partial<Clip> = {}): Clip =>
  ({ id, assetId: `a-${id}`, start, in: 0, out: 1000, speed: 1, volume: 1, fit: "cover", transform: { x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 }, text: null, keys: [], color: null, grades: [], crop: null, blend: "normal", key: null, seq: null, transition: null, fadeIn: 0, fadeOut: 0, shape: "rect", words: [], bg: null, own: false, sound: null, anim: null, fx: [], fix: null, ...extra }) as Clip;
const track = (id: string, kind: Track["kind"], clips: Clip[], locked = false): Track => ({ id, kind, name: id, muted: false, hidden: false, locked, duck: false, clips });
const tl = (tracks: Track[]): Timeline => ({ tracks, width: 1080, height: 1920, fps: 30, background: "#000", magnetic: false, markers: [] }) as unknown as Timeline;

describe("pasting one grading onto many clips", () => {
  const graded = [{ ...NEUTRAL_GRADE, on: true, name: "قريدنق", saturation: 1.2 }];
  const t = tl([
    track("v1", "video", [clip("a", 0, { grades: graded }), clip("b", 1000), clip("c", 2000)]),
    track("v2", "video", [clip("d", 0)]),
    track("v3", "video", [clip("lockedclip", 0)], true),
    track("t1", "text", [clip("title", 0, { text: { body: "x" } as Clip["text"] })]),
    track("au", "audio", [clip("music", 0)]),
  ]);

  it("only pictures on unlocked picture tracks can take it", () => {
    expect(gradeable(t, ["a", "b", "d", "lockedclip", "title", "music"]).sort()).toEqual(["a", "b", "d"]);
    expect(allGradeable(t, "a").sort()).toEqual(["b", "c", "d"]);
  });

  it("gives each clip its own copy of every layer, replacing what it had", () => {
    const cmds = pasteGradeCommands(graded, ["b", "c", "d"]);
    const out = applyAll(t, cmds, new Map()).timeline;
    for (const id of ["b", "c", "d"]) {
      const c = out.tracks.flatMap((x) => x.clips).find((x) => x.id === id)!;
      expect(c.grades.length, id).toBe(1);
      expect(c.grades[0].saturation, id).toBeCloseTo(1.2, 5);
    }
    // the copies are separate: changing one leaves the others alone
    const more = applyAll(out, [{ type: "update_clip", clipId: "b", patch: { grade: { saturation: 0.5, layer: 0 } } }], new Map()).timeline;
    const sat = (id: string) => more.tracks.flatMap((x) => x.clips).find((x) => x.id === id)!.grades[0].saturation;
    expect(sat("b")).toBeCloseTo(0.5, 5);
    expect(sat("c")).toBeCloseTo(1.2, 5);
  });
});
