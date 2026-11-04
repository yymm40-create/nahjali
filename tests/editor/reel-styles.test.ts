import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { CAPTION_STYLES, emptyTimeline, PERSON_EDGES, readBackdrop, type AssetInfo } from "@/lib/editor/model";
import { lintMotion } from "@/lib/editor/motion-build";
import { DOODLE_MARKS, newMotion, readMotion } from "@/lib/editor/motion-elements";
import { frameGeo, isQuestion, planFrames, readTalk, smartFrames, talkArt, talkCommands, type TalkCue } from "@/lib/editor/talk-motion";

// The motion styles on a talking person (a study of talking-head reels, 4 November 2026): the ones Haidara Cut lacked
// (a calm card frame, marks around the face, an emoji beside the head, an app card, speed lines, the person's edge as a
// sticker / a glow / echo copies, two-word captions) and the reel moving between its frames from what is said.

const w = (text: string, at = 0): TalkCue => ({ kind: "word", at, text });

describe("«يتنقّل بذكاء»: the frame from what is said", () => {
  it("a place takes a half, an app the corner, a number the punch-in, a question the card", () => {
    expect(smartFrames([[{ kind: "route", at: 0, text: "", from: "الرياض", to: "جدة" }]])).toEqual(["split-top"]);
    expect(smartFrames([[{ kind: "brand", at: 0, text: "انستا", brand: "instagram" }]])).toEqual(["corner"]);
    expect(smartFrames([[{ kind: "stat", at: 0, text: "من الناس", value: "70%" }]])).toEqual(["punch"]);
    expect(smartFrames([[w("شنو أول قصيدة لك؟")]])).toEqual(["card"]);
  });
  it("never freezes on one frame: no frame twice in a row, and a split changes its side", () => {
    const qs = Array.from({ length: 6 }, () => [w("ليش؟")]);
    const m = smartFrames(qs);
    for (let i = 1; i < m.length; i++) expect(m[i]).not.toBe(m[i - 1]);
    const plain = smartFrames(Array.from({ length: 12 }, () => [w("كلام")]));
    for (let i = 1; i < plain.length; i++) expect(plain[i]).not.toBe(plain[i - 1]);
    expect(new Set(plain).size).toBeGreaterThanOrEqual(5);
    const places = smartFrames([[{ kind: "pin", at: 0, text: "", to: "جدة" }], [{ kind: "pin", at: 0, text: "", to: "مكة" }]]);
    expect(places[0].startsWith("split")).toBe(true);
    expect(places[1]).not.toBe(places[0]);
  });
  it("reads a question in Gulf words or by its mark", () => {
    for (const q of ["شنو أول قصيدة لك", "تذكر؟", "ليش", "كم سعره"]) expect(isQuestion(q), q).toBe(true);
    for (const q of ["قصيدة", "الرياض", "شنوفة"]) expect(isQuestion(q), q).toBe(false);
  });
});

describe("the calm card frame", () => {
  it("keeps the person big in a window high on the page, the words under it", () => {
    const face = { x: 0.5, y: 0.4, w: 0.3, h: 0.2 };
    const g = frameGeo("card", 1080, 1920, face);
    const p = g.person({ x: 0.5, y: 0.5, scale: 1, rotate: 0, opacity: 1 });
    expect(p.scale).toBeGreaterThan(0.45);
    expect(p.scale).toBeLessThan(0.7);
    expect(g.panel?.hole).toBeTruthy();
    expect(g.area.y).toBeGreaterThan(0.6);
    expect(g.caption!).toBeGreaterThan(g.area.y);
  });
});

describe("a reel of plain words moves through its frames, and the punch-in gets a mark around the face", () => {
  const VIDEO: AssetInfo = { id: "v", kind: "video", durationMs: 40_000, width: 1080, height: 1920, hasAudio: true };
  it("builds clean and adds the face marks", () => {
    const infos = new Map<string, AssetInfo>([[VIDEO.id, VIDEO]]);
    let tl = emptyTimeline("9:16");
    tl = applyAll(tl, [{ type: "add_clip", assetId: VIDEO.id }], infos).timeline;
    const words = ["القصيدة", "الفريق", "المسابقة", "الجمهور", "الحماس", "يا سلام!", "الختام"];
    const plan = readTalk(JSON.stringify({ cues: words.map((t, i) => ({ kind: "word", at: 1000 + i * 5200, text: t })) }), 40_000)!;
    plan.face = { x: 0.5, y: 0.38, w: 0.3, h: 0.2 };
    const F = planFrames(plan, tl.width, tl.height, 40_000);
    for (let i = 1; i < F.modes.length; i++) expect(F.modes[i]).not.toBe(F.modes[i - 1]);
    expect(F.modes).toContain("card");
    expect(F.modes).toContain("punch");
    const art = talkArt(plan, tl.width, tl.height, 40_000);
    for (const a of art) infos.set(`img-${a.key}`, { id: `img-${a.key}`, kind: "image", durationMs: null, width: a.w, height: a.h });
    const built = talkCommands(plan, tl, 0, new Map(art.map((a) => [a.key, `img-${a.key}`])));
    const marks = built.commands.filter((c) => c.type === "add_motion");
    expect(marks.length).toBeGreaterThanOrEqual(1);
    for (const m of marks) expect(["doodle", "speedlines", "uicard", "emojipop"]).toContain((m as { kind: string }).kind);
    const out = applyAll(tl, built.commands, infos).timeline;
    const before = new Set(tl.tracks.flatMap((t) => t.clips.map((c) => c.id)));
    const fresh = new Set(out.tracks.flatMap((t) => t.clips.filter((c) => !before.has(c.id)).map((c) => c.id)));
    expect(lintMotion(out, fresh)).toEqual([]);
  });
});

describe("the new pieces read safely", () => {
  it("the face marks, the emoji, the app card and the speed lines", () => {
    expect(newMotion("doodle").mark).toBe("circle");
    expect(readMotion({ kind: "doodle", mark: "spiral" })!.mark).toBe("circle");
    expect(readMotion({ kind: "doodle", mark: "arrow" })!.mark).toBe("arrow");
    expect(Object.keys(DOODLE_MARKS)).toEqual(["circle", "arrow", "question", "stars", "cross"]);
    expect(newMotion("uicard").sub).toBeTruthy();
    expect(newMotion("emojipop").title).toBeTruthy();
    expect(readMotion({ kind: "speedlines" })).not.toBeNull();
  });
  it("the person's edge: a sticker, a glow or echo copies; anything else is none", () => {
    expect(Object.keys(PERSON_EDGES)).toEqual(["sticker", "glow", "echo"]);
    expect(readBackdrop({ mode: "remove", edge: "sticker" }).edge).toBe("sticker");
    expect(readBackdrop({ mode: "remove", edge: "fire" }).edge).toBeUndefined();
    expect(readBackdrop({ edge: "" }, { ...readBackdrop({ mode: "remove" }), edge: "glow" }).edge).toBeUndefined();
  });
  it("two-word captions are a caption look", () => {
    expect(CAPTION_STYLES.pop2.label).toBe("كلمتين كلمتين");
    expect(CAPTION_STYLES.pop2.style.size).toBeGreaterThan(CAPTION_STYLES.karaoke.style.size);
  });
});
