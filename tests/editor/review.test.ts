import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline, type Timeline } from "@/lib/editor/model";
import {
  anchorsFit,
  anchorsOf,
  canManageReview,
  cleanAt,
  cleanBody,
  cleanName,
  cleanShape,
  expiryFrom,
  isReviewSlug,
  linkState,
  looksLikeBot,
  mapTime,
  newReviewSlug,
  nextVersionN,
  publicCommentBlock,
  readAnchors,
  REVIEW_LIMITS,
  reviewNote,
  versionName,
  videosToPrune,
  ASKS_ABOUT_REVIEW,
} from "@/lib/editor/review";
import { lib, main, video } from "./helpers";

const assets = lib(video("a", 4000), video("b", 6000), video("c", 5000));
/** a ‖ b ‖ c on the main track: 0–4 s, 4–10 s, 10–15 s */
const three = (): Timeline => applyAll(emptyTimeline("9:16"), [{ type: "add_clip", assetId: "a" }, { type: "add_clip", assetId: "b" }, { type: "add_clip", assetId: "c" }], assets).timeline;
const clipOf = (t: Timeline, asset: string) => main(t).clips.find((c) => c.assetId === asset)!;
const NOW = Date.parse("2026-11-12T10:00:00Z");

describe("review link: who may do what", () => {
  it("only the project's owner manages the review", () => {
    expect(canManageReview({ user_id: "owner" }, "owner")).toBe(true);
    expect(canManageReview({ user_id: "owner" }, "team-member")).toBe(false);
  });

  it("the public may comment only on an active, unexpired link, on a version that still has its video", () => {
    const on = { active: true, expires_at: null };
    const v = { storage_path: "u/refs/x.mp4" };
    expect(publicCommentBlock(on, v, NOW)).toBeNull();
    expect(publicCommentBlock({ active: false, expires_at: null }, v, NOW)).toMatch(/وقّف/);
    expect(publicCommentBlock({ active: true, expires_at: new Date(NOW - 1000).toISOString() }, v, NOW)).toMatch(/انتهت/);
    expect(publicCommentBlock(on, null, NOW)).toMatch(/ما لقينا/);
    expect(publicCommentBlock(on, { storage_path: null }, NOW)).toMatch(/انحذف/);
  });

  it("states and expiry", () => {
    expect(linkState({ active: true, expires_at: expiryFrom("7", NOW) }, NOW)).toBe("on");
    expect(linkState({ active: true, expires_at: expiryFrom("1", NOW) }, NOW + 2 * 86_400_000)).toBe("expired");
    expect(linkState({ active: false, expires_at: null }, NOW)).toBe("off");
    expect(expiryFrom("none", NOW)).toBeNull();
  });

  it("makes unguessable slugs", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const s = newReviewSlug();
      expect(s).toHaveLength(24);
      expect(isReviewSlug(s)).toBe(true);
      seen.add(s);
    }
    expect(seen.size).toBe(300);
    for (const bad of ["short", "../../etc/passwd-aaaaaaaaaaaaaa", "a".repeat(41), 42, null]) expect(isReviewSlug(bad)).toBe(false);
  });
});

describe("review link: what the client types", () => {
  it("cleans the name", () => {
    expect(cleanName("  أبو محمد  ")).toBe("أبو محمد");
    expect(cleanName("<b>سارة</b>")).toBe("سارة");
    expect(cleanName("")).toBeNull();
    expect(cleanName("x".repeat(REVIEW_LIMITS.name + 1))).toBeNull();
    expect(cleanName("visit www.spam.com")).toBeNull();
  });

  it("keeps comments as plain text, without HTML, links, control characters or floods", () => {
    expect(cleanBody("  كبّر الشعار شوي  ")).toEqual({ ok: true, text: "كبّر الشعار شوي" });
    expect(cleanBody('<script>alert(1)</script>غيّر اللون')).toEqual({ ok: true, text: "alert(1)غيّر اللون" });
    expect(cleanBody("<img src=x onerror=alert(1)>")).toMatchObject({ ok: false });
    expect(cleanBody("a\u0000b‮c\n\n\n\nd")).toEqual({ ok: true, text: "abc\n\nd" });
    for (const link of ["شوف https://evil.example", "www.site.org", "اضغط bit.ly/x", "t.me/channel", "promo.shop"]) expect(cleanBody(link)).toEqual({ ok: false, error: "الروابط ممنوعة في التعليقات." });
    expect(cleanBody("")).toMatchObject({ ok: false });
    expect(cleanBody("   ")).toMatchObject({ ok: false });
    expect(cleanBody(42)).toMatchObject({ ok: false });
    const words = (n: number) => "كلمة ".repeat(n / 5).trim() + "ة".repeat(n - ("كلمة ".repeat(n / 5).trim().length));
    expect(words(REVIEW_LIMITS.body)).toHaveLength(REVIEW_LIMITS.body);
    expect(cleanBody(words(REVIEW_LIMITS.body))).toMatchObject({ ok: true });
    expect(cleanBody(words(REVIEW_LIMITS.body) + "ة")).toMatchObject({ ok: false, error: expect.stringMatching(/طويل/) });
    expect(cleanBody("!".repeat(40))).toMatchObject({ ok: false });
  });

  it("keeps the moment inside the version and the drawing inside the frame", () => {
    expect(cleanAt(1234.6, 10_000)).toBe(1235);
    expect(cleanAt(-5, 10_000)).toBe(0);
    expect(cleanAt(99_999, 10_000)).toBe(10_000);
    expect(cleanAt(null, 10_000)).toBeNull();
    expect(cleanAt("nope", 10_000)).toBeNull();
    expect(cleanShape({ t: "box", x1: 0.8, y1: 0.9, x2: 0.2, y2: -3 })).toEqual({ t: "box", x1: 0.2, y1: 0, x2: 0.8, y2: 0.9 });
    expect(cleanShape({ t: "arrow", x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.55555 })).toEqual({ t: "arrow", x1: 0.1, y1: 0.1, x2: 0.5, y2: 0.556 });
    expect(cleanShape({ t: "box", x1: 0.5, y1: 0.5, x2: 0.505, y2: 0.5 })).toBeNull();
    expect(cleanShape({ t: "circle", x1: 0, y1: 0, x2: 1, y2: 1 })).toBeNull();
    expect(cleanShape("<svg>")).toBeNull();
  });

  it("the spam guard: the hidden field, and a comment sent before it could be typed", () => {
    expect(looksLikeBot({ website: "", typedMs: 5000 })).toBe(false);
    expect(looksLikeBot({ website: "http://x", typedMs: 5000 })).toBe(true);
    expect(looksLikeBot({ typedMs: 200 })).toBe(true);
    expect(looksLikeBot({})).toBe(true);
  });
});

describe("review link: versions", () => {
  it("numbers versions on the same link", () => {
    expect(nextVersionN([])).toBe(1);
    expect(nextVersionN([1, 2, 3])).toBe(4);
    expect(nextVersionN([1, 3])).toBe(4);
    expect(versionName(2)).toBe("نسخة ٢");
    expect(versionName(12)).toBe("نسخة ١٢");
  });

  it("keeps the video of the newest five versions only (the comments stay)", () => {
    const vs = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ n, storage_path: n === 1 ? null : `p${n}` }));
    expect(videosToPrune(vs).map((v) => v.n)).toEqual([2]);
    expect(videosToPrune(vs.slice(0, 5))).toEqual([]);
  });
});

describe("review link: a comment's time on the timeline now", () => {
  it("is the same time while the project hasn't changed", () => {
    const t = three();
    const anchors = anchorsOf(t);
    expect(anchors.map((x) => x.k)).toEqual(["m", "m", "m"]);
    expect(mapTime(anchors, 5000, t)).toEqual({ at: 5000, how: "same" });
    expect(readAnchors(JSON.parse(JSON.stringify(anchors)))).toEqual(anchors);
  });

  it("follows its clip when an earlier clip is deleted", () => {
    const t0 = three();
    const anchors = anchorsOf(t0);
    const t1 = applyAll(t0, [{ type: "delete", clipIds: [clipOf(t0, "a").id], ripple: true }], assets).timeline;
    expect(clipOf(t1, "b").start).toBe(0);
    expect(mapTime(anchors, 5000, t1)).toEqual({ at: 1000, how: "moved" });
    expect(mapTime(anchors, 12_000, t1)).toEqual({ at: 8000, how: "moved" });
    // the moment was in the deleted clip: kept on the version's own time
    expect(mapTime(anchors, 2000, t1)).toEqual({ at: 2000, how: "lost" });
  });

  it("finds the same moment of the file after a split (the right part has a new id)", () => {
    const t0 = three();
    const anchors = anchorsOf(t0);
    const t1 = applyAll(t0, [{ type: "split", at: 7000 }, { type: "delete", clipIds: [clipOf(t0, "a").id], ripple: true }], assets).timeline;
    expect(mapTime(anchors, 8000, t1)).toEqual({ at: 4000, how: "moved" });
  });

  it("follows a speed change", () => {
    const t0 = three();
    const anchors = anchorsOf(t0);
    const b = clipOf(t0, "b");
    const t1 = applyAll(t0, [{ type: "update_clip", clipId: b.id, patch: { speed: 2 } }], assets).timeline;
    // 2 s into b (its source 2000) now plays 1 s into it
    expect(mapTime(anchors, 6000, t1)).toEqual({ at: 5000, how: "moved" });
  });

  it("says when nothing can be found, and needs a video as long as the project", () => {
    expect(mapTime([], 3000, three())).toEqual({ at: 3000, how: "lost" });
    expect(anchorsFit(15_000, 15_040)).toBe(true);
    expect(anchorsFit(15_000, 9_000)).toBe(false);
    expect(anchorsFit(0, 9_000)).toBe(false);
  });
});

describe("review link: حيدرا ماكس's note", () => {
  it("gives the open comments as the client's data, with their time now", () => {
    const note = reviewNote([
      { n: 2, author: "سارة", body: "الشعار صغير", at: { at: 4200, how: "moved" }, shape: { t: "box", x1: 0.1, y1: 0.1, x2: 0.3, y2: 0.2 }, replies: ["owner: أبشري"] },
      { n: 1, author: "خالد", body: "احذف هذا المقطع", at: { at: 9000, how: "lost" }, shape: null, replies: [] },
      { n: 2, author: "خالد", body: "الموسيقى عالية", at: null, shape: null, replies: [] },
    ]);
    expect(note).toMatch(/DATA/);
    expect(note).toContain("نسخة ٢");
    expect(note).toContain("4.20 s");
    expect(note).toContain("drew a box");
    expect(note).toContain("the project changed");
    expect(note).toContain("the whole video");
    expect(reviewNote([])).toBe("");
  });

  it("rides only with a turn about the client's comments", () => {
    expect(ASKS_ABOUT_REVIEW.test("نفّذ تعليقات العميل")).toBe(true);
    expect(ASKS_ABOUT_REVIEW.test("وش قال العميل؟")).toBe(true);
    expect(ASKS_ABOUT_REVIEW.test("حط تعليق صوتي على البداية")).toBe(false);
    expect(ASKS_ABOUT_REVIEW.test("قص السكتات")).toBe(false);
  });
});

describe("review link: the address limit", () => {
  it("the public page's comments are limited per address before anything runs", async () => {
    const { rulesFor } = await import("@/lib/rate-limit");
    expect(rulesFor("/api/review/abcdefghijklmnopqrstuvwx", "POST").map((r) => r.key)).toContain("review");
    expect(rulesFor("/api/review/abcdefghijklmnopqrstuvwx", "GET").map((r) => r.key)).not.toContain("review");
  });
});
