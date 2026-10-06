import { describe, expect, it } from "vitest";
import { parseSRT, phrases, toSRT, verses } from "@/components/jawad/editor/captions";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { lib } from "./helpers";

const words = "أهلا وسهلا بكم في الممنتج الذكي هذا اختبار".split(" ").map((w, i) => ({ s: i * 400, e: i * 400 + 350, w }));

describe("captions", () => {
  it("groups spoken words into short phrases that keep their timing", () => {
    const p = phrases(words, 4);
    expect(p.length).toBeGreaterThanOrEqual(2);
    expect(p.flatMap((x) => x.body.split(" "))).toEqual(words.map((w) => w.w));
    expect(p[0].start).toBe(0);
    expect(p.at(-1)!.end).toBe(words.at(-1)!.e);
  });

  it("keeps one caption per verse of a poem", () => {
    const poem = "قفا نبك من ذكرى\nحبيب ومنزل";
    const timed = poem.split(/\s+/).map((w, i) => ({ s: i * 500, e: i * 500 + 400, w }));
    expect(verses(poem, timed)?.map((v) => v.body)).toEqual(["قفا نبك من ذكرى", "حبيب ومنزل"]);
  });

  it("writes SRT and reads it (and WebVTT) back", () => {
    const t = applyAll(emptyTimeline(), [{ type: "add_captions", items: phrases(words, 4), style: "classic" }], lib()).timeline;
    const srt = toSRT(t);
    expect(srt).toMatch(/^1\n00:00:00,000 --> /);
    expect(parseSRT(srt).map((x) => x.body)).toEqual(phrases(words, 4).map((x) => x.body));
    expect(parseSRT("WEBVTT\n\n00:00:04.000 --> 00:00:05.500\nسطر من ملف\n")).toEqual([{ start: 4000, end: 5500, body: "سطر من ملف" }]);
  });
});
