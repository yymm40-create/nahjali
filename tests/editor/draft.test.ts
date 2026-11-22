import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@config/feature-use";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { LIMITS as PRICES } from "@/lib/film/limits";
import { applyAll } from "@/lib/editor/commands";
import {
  assembleDraft,
  captionItems,
  draftCommands,
  draftParts,
  draftTotal,
  DRAFT_LENGTHS,
  DRAFT_ROUTES,
  emptyScene,
  fitDurations,
  nextToStart,
  partSpec,
  placeLate,
  planIssues,
  planSeconds,
  priceGroups,
  readOptions,
  readPlan,
  retryParts,
  ROUTE_ORDER,
  runSummary,
  samplePlan,
  sceneRange,
  sceneState,
  suggestedScenes,
  type DraftFile,
  type DraftPlan,
  type DraftRoute,
  type PartRun,
} from "@/lib/editor/draft";
import { clipEnd, emptyTimeline, readTimeline, type Timeline } from "@/lib/editor/model";
import { image, lib, sound, video } from "./helpers";

const scene = (seconds: number, i = 0) => ({ ...emptyScene(seconds), narration: `هذا كلام المشهد رقم ${i + 1} في الفيديو.`, onScreen: `فكرة ${i + 1}`, visual: "a calm desert road at sunrise, wide shot" });
const planOf = (secs: number[]): DraftPlan => ({ title: "ماء كفاية", music: "soft piano", scenes: secs.map((s, i) => scene(s, i)) });
const opts = (route: DraftRoute, more: Record<string, unknown> = {}) => readOptions({ seconds: 30, route, ...more });

describe("the plan", () => {
  it("reads anything safely and keeps the limits", () => {
    const p = readPlan({ title: "x".repeat(500), scenes: [...Array(40)].map(() => ({ narration: 5, seconds: "abc", motion: "nope", points: ["a", "b", "c", "d"] })), music: null });
    expect(p.title.length).toBe(80);
    expect(p.scenes.length).toBe(15);
    expect(p.scenes[0]).toEqual({ narration: "", onScreen: "", visual: "", seconds: 4, motion: "title", points: ["a", "b", "c"] });
    expect(readPlan(null)).toEqual({ title: "", scenes: [], music: "" });
  });

  it("knows how many scenes fit each length on each route", () => {
    for (const s of DRAFT_LENGTHS)
      for (const r of ROUTE_ORDER) {
        const { min, max } = sceneRange(s, r);
        expect(min).toBeGreaterThanOrEqual(1);
        expect(max).toBeLessThanOrEqual(15);
        expect(suggestedScenes(s, r)).toBeGreaterThanOrEqual(min);
        expect(suggestedScenes(s, r)).toBeLessThanOrEqual(max);
        // the usual count can always reach the length inside the route's scene lengths
        expect(suggestedScenes(s, r) * DRAFT_ROUTES[r].maxSec).toBeGreaterThanOrEqual(s * 0.9);
      }
  });

  it("accepts lengths within ±10% and refuses the rest", () => {
    expect(planIssues(planOf([5, 5, 5, 5, 5, 5]), opts("images"))).toEqual([]);
    expect(planIssues(planOf([5, 5, 5, 5, 6, 6.5]), opts("images"))).toEqual([]); // 32.5 s
    expect(planIssues(planOf([5, 5, 5, 5, 5, 8]), opts("images"))).toEqual([]); // 33 s: +10% is the edge
    expect(planIssues(planOf([5, 5, 5, 5, 5, 9]), opts("images")).join()).toContain("مجموع المدد 34");
    expect(planIssues(planOf([4, 4, 4, 4, 4, 4]), opts("images")).join()).toContain("وزّع المدد"); // 24 s
  });

  it("checks the scene limits per route", () => {
    expect(planIssues(planOf([30]), opts("images")).join()).toContain("قليلة");
    expect(planIssues(planOf([...Array(16)].map(() => 2)), opts("images")).join()).toContain("كثيرة");
    expect(planIssues(planOf([...Array(16)].map(() => 2)), opts("images")).join()).not.toContain("لازم بين"); // 2 s is fine
    expect(planIssues(planOf([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]), opts("video")).join()).toContain("لازم بين 4 و15");
    expect(planIssues(planOf([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]), opts("video")).join()).toContain("كثيرة");
    const empty = planOf([10, 10, 10]);
    empty.scenes[1] = { ...empty.scenes[1], narration: "", visual: "" };
    const issues = planIssues(empty, opts("images"));
    expect(issues).toContain("المشهد 2: ما فيه كلام للتعليق الصوتي.");
    expect(issues).toContain("المشهد 2: ما فيه وصف للي ينشاف.");
    // no voice-over: no narration needed; motion only: no visual needed
    expect(planIssues({ ...empty, scenes: empty.scenes.map((s) => ({ ...s, visual: "" })) }, opts("motion", { voice: "none" }))).toEqual([]);
  });

  it("fits the lengths to the wanted length inside the route's bounds", () => {
    for (const route of ROUTE_ORDER) {
      for (const seconds of DRAFT_LENGTHS) {
        const n = suggestedScenes(seconds, route);
        const p = fitDurations(planOf([...Array(n)].map((_, i) => 1 + (i % 3) * 7)), seconds, route);
        expect(planSeconds(p)).toBe(seconds);
        for (const s of p.scenes) {
          expect(s.seconds).toBeGreaterThanOrEqual(DRAFT_ROUTES[route].minSec);
          expect(s.seconds).toBeLessThanOrEqual(DRAFT_ROUTES[route].maxSec);
          expect(s.seconds * 2).toBe(Math.round(s.seconds * 2));
        }
        expect(planIssues(p, readOptions({ seconds, route }))).toEqual([]);
      }
    }
  });
});

describe("the price", () => {
  const priced = (route: DraftRoute, more: Record<string, unknown> = {}) => {
    const o = opts(route, more);
    const coins: Record<string, number> = { image: 60, video: 900, speech: 15, music: 120 };
    return draftParts(planOf([5, 5, 5, 5, 5, 5]), o).map((p) => ({ ...p, coins: coins[p.kind] }));
  };

  it("lists the parts of each route (no generation of pictures in «موشن بالكود فقط»)", () => {
    expect(priced("motion").map((p) => p.kind)).toEqual(["music", ...Array(6).fill("speech")]);
    expect(priced("images").filter((p) => p.kind === "image").length).toBe(6);
    expect(priced("video").filter((p) => p.kind === "video").length).toBe(6);
    expect(priced("images", { voice: "none", music: false }).map((p) => p.kind)).toEqual(Array(6).fill("image"));
  });

  it("totals every route as the sum of its parts, and the groups add up to it", () => {
    for (const route of ROUTE_ORDER) {
      const parts = priced(route);
      const g = priceGroups(parts);
      expect(g.total).toBe(parts.reduce((m, p) => m + p.coins, 0));
      expect(draftTotal(parts)).toBe(g.total);
      expect(g.visuals + g.voice + g.music).toBe(g.total);
    }
    // cheapest first
    expect(draftTotal(priced("motion"))).toBeLessThan(draftTotal(priced("images")));
    expect(draftTotal(priced("images"))).toBeLessThan(draftTotal(priced("video")));
    expect(draftTotal([{ coins: -5 }, { coins: 3.4 }, { coins: NaN }])).toBe(3);
  });

  it("asks each generator for the right thing", () => {
    const p = planOf([5, 5, 5, 5, 5, 5]);
    const o = opts("video", { ratio: "9:16", voice: "مازن" });
    const [m, v0, s0] = draftParts(p, o);
    expect(partSpec(v0, p, o)).toMatchObject({ makeKind: "video", seconds: 5, aspect: "9:16", withSound: false, place: "library" });
    expect(partSpec(v0, p, o).prompt).toContain("No on-screen text");
    expect(partSpec(s0, p, o)).toMatchObject({ makeKind: "speech", voice: "مازن", prompt: p.scenes[0].narration });
    expect(partSpec(m, p, o)).toMatchObject({ makeKind: "music", seconds: 30, withSound: false });
    const img = partSpec(draftParts(p, opts("images"))[1], p, opts("images"));
    expect(img).toMatchObject({ makeKind: "image", quality: "medium" });
    expect(img.prompt).toMatch(/No writing/);
  });

  it("prices a route before the plan with a stand-in of the usual size", () => {
    for (const r of ROUTE_ORDER) {
      const s = samplePlan(60, r, "ar");
      expect(s.scenes.length).toBe(suggestedScenes(60, r));
      expect(planIssues(s, readOptions({ seconds: 60, route: r }))).toEqual([]);
    }
  });
});

const fileOf = (assetId: string, kind: DraftFile["kind"], durationMs: number | null): DraftFile => ({ assetId, kind, durationMs });

describe("the assembly", () => {
  const p = planOf([5, 5, 5, 5, 5, 5]);
  const filesFor = (route: DraftRoute, skip: string[] = []) => {
    const f: Record<string, DraftFile> = { m: fileOf("mus", "audio", 40_000) };
    p.scenes.forEach((_, i) => {
      f[`s${i}`] = fileOf(`voice${i}`, "audio", 4200);
      if (route === "images") f[`v${i}`] = fileOf(`img${i}`, "image", null);
      if (route === "video") f[`v${i}`] = fileOf(`vid${i}`, "video", 5000);
    });
    for (const k of skip) delete f[k];
    return f;
  };
  const assets = lib(sound("mus", 40_000), ...p.scenes.flatMap((_, i) => [sound(`voice${i}`, 4200), image(`img${i}`), video(`vid${i}`, 5000, false)]));

  const check = (t: Timeline) => {
    const again = readTimeline(JSON.parse(JSON.stringify(t)), new Set(assets.keys()));
    // nothing is dropped or moved by the editor's own reading (a valid timeline)
    expect(again.tracks.map((x) => x.clips.length)).toEqual(t.tracks.map((x) => x.clips.length));
    expect(again.tracks.flatMap((x) => x.clips.map((c) => c.start))).toEqual(t.tracks.flatMap((x) => x.clips.map((c) => c.start)));
    for (const tr of t.tracks) for (let i = 1; i < tr.clips.length; i++) expect(tr.clips[i].start).toBeGreaterThanOrEqual(clipEnd(tr.clips[i - 1]));
  };

  it("builds pictures moving on the voice, words, captions, voice and ducking music", () => {
    const b = assembleDraft(p, opts("images"), filesFor("images"), { colors: ["#e11d48"], font: null });
    check(b.timeline);
    const t = b.timeline;
    expect(t.width).toBe(1080);
    expect(t.height).toBe(1920);
    expect(t.magnetic).toBe(true);
    const main = t.tracks.find((x) => x.kind === "video")!;
    expect(main.clips.map((c) => c.assetId)).toEqual(p.scenes.map((_, i) => `img${i}`));
    // each scene lasts its voice and a breath, one after the other
    expect(main.clips.map((c) => c.start)).toEqual([0, 4550, 9100, 13650, 18200, 22750]);
    expect(main.clips.every((c) => c.keys.length === 2)).toBe(true);
    expect(main.clips.slice(0, -1).every((c) => c.transition?.kind === "softDissolve")).toBe(true);
    expect(main.clips.at(-1)!.transition).toBeNull();
    expect(t.tracks[0]).toMatchObject({ kind: "text", motion: true });
    expect(t.tracks[0].clips[0].motion?.kind).toBe("ambient");
    const music = t.tracks.find((x) => x.name === "الموسيقى")!;
    expect(music.duck).toBe(true);
    expect(clipEnd(music.clips[0])).toBe(27_300);
    const voice = t.tracks.find((x) => x.name === "التعليق الصوتي")!;
    expect(voice.duck).toBe(false);
    expect(voice.clips.map((c) => c.start)).toEqual(main.clips.map((c) => c.start));
    const cap = t.tracks.find((x) => x.name === "كابشن")!;
    expect(cap.clips.length).toBeGreaterThan(6);
    expect(cap.clips.every((c) => c.words.length > 0 && c.text?.highlight === "#e11d48")).toBe(true);
    expect(cap.clips.map((c) => c.text?.body).join(" ")).toBe(p.scenes.map((s) => s.narration).join(" "));
    const words = t.tracks.find((x) => x.name === "كلام الشاشة")!;
    expect(words.clips.map((c) => c.text?.body)).toEqual(p.scenes.map((s) => s.onScreen));
    expect(words.clips[0].text?.box).toBe("#e11d48");
  });

  it("puts the draft on as ONE change, in a new timeline when the open one has clips", () => {
    const b = assembleDraft(p, opts("images"), filesFor("images"), { colors: [], font: null });
    const fresh = applyAll(emptyTimeline("16:9"), draftCommands(b, emptyTimeline("16:9"), "ماء"), assets);
    expect(fresh.timeline.height).toBe(1920);
    expect(fresh.timeline.seqs).toBeUndefined();
    const busy = applyAll(emptyTimeline(), [{ type: "add_clip", assetId: "vid0" }], assets).timeline;
    const r = applyAll(busy, draftCommands(b, busy, "ماء"), assets);
    expect(r.timeline.seqs?.length).toBe(2);
    expect(r.timeline.tracks.find((x) => x.kind === "video")!.clips.length).toBe(6);
  });

  it("slows a video a little when the voice is longer, and never below half speed", () => {
    const f = filesFor("video");
    f.s0 = fileOf("voice0", "audio", 5650); // scene 6 s, the video 5 s
    f.s1 = fileOf("voice1", "audio", 20_000);
    const b = assembleDraft(p, opts("video"), f, { colors: [], font: null });
    check(b.timeline);
    const [a, c] = b.timeline.tracks.find((x) => x.kind === "video")!.clips;
    expect(a.speed).toBeCloseTo(5000 / 6000, 3);
    expect(clipEnd(a) - a.start).toBe(6000);
    expect(c.speed).toBe(0.5);
    // the slowed video still ends before its long scene: the magnet stays off, nothing slides
    expect(b.timeline.magnetic).toBe(false);
    expect(a.volume).toBe(0);
  });

  it("draws «موشن بالكود فقط» as motion elements with no picture at all", () => {
    const q: DraftPlan = { ...p, scenes: p.scenes.map((s, i) => ({ ...s, visual: "", motion: (["title", "phrase", "list", "big"] as const)[i % 4], points: ["أول", "ثاني"], onScreen: i % 4 === 3 ? "٣ أكواب" : s.onScreen })) };
    const b = assembleDraft(q, opts("motion"), filesFor("motion"), { colors: ["#22c55e", "#0ea5e9"], font: "cairo" });
    check(b.timeline);
    const els = b.timeline.tracks.find((x) => x.name === "موشن المشاهد")!.clips.map((c) => c.motion!);
    expect(els.map((m) => m.kind)).toEqual(["title", "phrase", "list", "big", "title", "phrase"]);
    expect(els[2].items.map((x) => x.text)).toEqual(["أول", "ثاني"]);
    expect(els[3].sub).toBe("٣");
    expect(els[0].colors?.accent).toBe("#22c55e");
    expect(b.timeline.tracks.find((x) => x.kind === "video")!.clips).toEqual([]);
  });

  it("times caption words inside the phrase, in order", () => {
    const items = captionItems("واحد اثنين ثلاثة. أربعة خمسة", 1000, 3000, 4);
    expect(items.map((x) => x.body)).toEqual(["واحد اثنين ثلاثة.", "أربعة خمسة"]);
    expect(items[0].start).toBe(1000);
    expect(items[1].end).toBeLessThanOrEqual(4000);
    for (const it of items) for (const w of it.words) expect(w.e).toBeGreaterThanOrEqual(w.s);
  });
});

describe("partial failures", () => {
  const p = planOf([5, 5, 5, 5, 5, 5]);
  const part = (key: string, state: PartRun["state"], scene: number | null, kind: PartRun["kind"] = "image"): PartRun => ({ key, kind, scene, coins: 10, state, attempt: 0, jobId: null });

  it("leaves a failed scene's place, the magnet off so nothing slides", () => {
    const f: Record<string, DraftFile> = {};
    p.scenes.forEach((_, i) => {
      f[`s${i}`] = fileOf(`voice${i}`, "audio", 4200);
      if (i !== 2) f[`v${i}`] = fileOf(`img${i}`, "image", null);
    });
    const b = assembleDraft(p, opts("images"), f, { colors: [], font: null });
    expect(b.gaps).toEqual([2]);
    expect(b.timeline.magnetic).toBe(false);
    const assets = lib(...p.scenes.flatMap((_, i) => [sound(`voice${i}`, 4200), image(`img${i}`)]), image("again"));
    const placed = applyAll(emptyTimeline(), draftCommands(b, emptyTimeline(), "x"), assets).timeline;
    const main = () => placed.tracks.find((x) => x.kind === "video")!;
    expect(main().clips.map((c) => c.start)).toEqual([0, 4550, 13650, 18200, 22750]);
    // «أعد هالمشهد»: the new picture lands in its own place, the others stay where they were
    const after = applyAll(placed, placeLate(b.info, { kind: "image", scene: 2 }, fileOf("again", "image", null)), assets).timeline;
    const m = after.tracks.find((x) => x.kind === "video")!;
    expect(m.clips.map((c) => [c.assetId, c.start, clipEnd(c)])).toEqual([
      ["img0", 0, 4550],
      ["img1", 4550, 9100],
      ["again", 9100, 13650],
      ["img3", 13650, 18200],
      ["img4", 18200, 22750],
      ["img5", 22750, 27300],
    ]);
  });

  it("knows when a run is settled, keeps to the running limit, and queues retries as new attempts", () => {
    const parts = [part("m", "ready", null, "music"), part("v0", "waiting", 0), part("s0", "failed", 0, "speech"), part("v1", "queued", 1), part("s1", "queued", 1, "speech"), part("v2", "starting", 2)];
    expect(runSummary(parts)).toMatchObject({ total: 6, done: 1, failed: 1, left: 4, active: 2, settled: false });
    expect(nextToStart(parts, 3).map((x) => x.key)).toEqual(["v1"]);
    expect(nextToStart(parts, 2)).toEqual([]);
    expect(sceneState(parts, 0)).toBe("failed");
    expect(sceneState(parts, 1)).toBe("queued");
    expect(sceneState(parts, 2)).toBe("working");
    expect(sceneState(parts, 5)).toBe("none");
    const again = retryParts(parts, ["s0", "v1"]);
    expect(again.find((x) => x.key === "s0")).toMatchObject({ state: "queued", attempt: 1, jobId: null, error: null });
    // only failed parts are made again
    expect(again.find((x) => x.key === "v1")).toEqual(parts[3]);
    expect(runSummary([part("a", "ready", 0), part("b", "failed", 1), part("c", "stopped", 2)]).settled).toBe(true);
  });
});

describe("the wiring", () => {
  it("prices the planning first, gives it back on failure, keeps per-call facts out of the system", () => {
    expect(PRICES.editor_price_draft.default).toBeGreaterThan(0);
    const server = readFileSync("src/lib/editor/draft-server.ts", "utf8");
    expect(server).toContain('charged(who, "editor_price_draft"');
    expect(server).toContain('code: "price_changed"');
    expect(server).toContain("turnNote: note");
    expect(server).not.toMatch(/const SYSTEM = `[^`]*\$\{/);
    expect(server).toMatch(/no realistic adult women and no girls/);
    expect(server).toMatch(/no traditional Gulf dress or thobes/);
    const route = readFileSync("src/app/api/jawad/editor/projects/[id]/route.ts", "utf8");
    for (const a of ["draft_quote", "draft_plan", "draft_price", "draft_start"]) {
      expect(route).toContain(`case "${a}"`);
      expect(route).toMatch(new RegExp(`AI_ACTIONS = new Set\\(\\[[^\\]]*"${a}"`));
    }
  });

  it("starts each part as an ordinary JAWAD AI job with the style and the brand", () => {
    const server = readFileSync("src/lib/editor/draft-server.ts", "utf8");
    expect(server).toContain("startMake(user, owner,");
    const make = readFileSync("src/lib/editor/make-any.ts", "utf8");
    expect(make).toMatch(/styleId: p\.styleId/);
    expect(make).toMatch(/brand: true/);
  });

  it("counts its uses and is described for the owner", () => {
    const ids = FEATURES.map((f) => f.id as string);
    for (const id of ["editor.draft_home", "editor.draft_open", "editor.draft_plan", "editor.draft_start", "editor.draft_built", "editor.draft_retry"]) expect(ids).toContain(id);
    expect(JAWAD_KNOWLEDGE).toContain("«✨ من فكرة لمسودة»");
    expect(JAWAD_KNOWLEDGE).toContain("editor_price_draft");
  });

  it("is a request حيدرا ماكس can make, and opens from the launcher", () => {
    expect(readFileSync("src/lib/editor/assistant.ts", "utf8")).toMatch(/"multicam", "draft"\]/);
    expect(readFileSync("src/components/jawad/editor/AssistantPanel.tsx", "utf8")).toContain('q.kind === "draft"');
    expect(readFileSync("src/components/jawad/editor/EditorHome.tsx", "utf8")).toContain("من فكرة لمسودة");
  });
});
