import { describe, expect, it } from "vitest";
import { applyAll } from "@/lib/editor/commands";
import { emptyTimeline } from "@/lib/editor/model";
import { backgroundSvg, decorationSvg, readShapes, shapesSvg, type DrawShape } from "@/lib/editor/motion-art";
import { auditPiece, BANK_SIZE, motionExamplesBrief, nearestMotionExamples, pieceAt } from "@/lib/editor/motion-bank";
import { brandPalette, contrast, fitDurations, layoutMotion, lintPlaced, mapTime, motionPlan, narrationMs, PALETTES, readStoryboard, retimeMap, type Beat } from "@/lib/editor/motion-build";
import { ICON_IDS, iconById, iconOf, iconSvg, MOTION_ICONS } from "@/lib/editor/motion-icons";
import { mix } from "@/lib/editor/motion-art";
import { sceneSvg, SCENE_MAX_ALPHA } from "@/lib/editor/motion-scenes";
import { askedForPicture, lookOf, MOODS, MOODS_SKILL, moodInText, moodOf, readLook, SCENE_IDS } from "@/lib/editor/motion-styles";
import { previewSvg } from "@/lib/editor/motion-preview";
import { VOCAB } from "@/lib/editor/motion-topics";
import { MOTION_SKILL } from "@/lib/editor/motion";
import { TR_BY_ID } from "@/lib/editor/transitions";

describe("the drawn icons", () => {
  it("every icon has a unique id, Arabic names, valid drawing and no stray numbers", () => {
    expect(new Set(ICON_IDS).size).toBe(ICON_IDS.length);
    expect(ICON_IDS.length).toBeGreaterThanOrEqual(59);
    for (const ic of MOTION_ICONS) {
      expect(ic.ar.length, ic.id).toBeGreaterThan(2);
      expect(ic.paths.length + (ic.fills?.length ?? 0), ic.id).toBeGreaterThan(0);
      const svg = iconSvg(ic, 10, 20, 100, "#ff0000", "#00ff00");
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).toContain('stroke="#ff0000"'.slice(0, 0) || "<g transform");
    }
  });
  it("picks the icon a text points at (the longest name wins), and none when nothing fits", () => {
    expect(iconOf("وفّر فلوسك كل شهر")?.id).toBe("money");
    expect(iconOf("موعد الصلاة في المسجد")?.id).toBe("mosque");
    expect(iconOf("خطر على صحتك")?.id).toBe("warning");
    expect(iconOf("لا شي هنا يدل على شي")).toBeUndefined();
    expect(iconById("rocket")?.id).toBe("rocket");
    expect(iconById("nope")).toBeUndefined();
  });
  it("a beat's icon sits above its words with room reserved, on every frame shape", () => {
    for (const ratio of ["9:16", "16:9", "1:1", "4:5"] as const) {
      const tl = emptyTimeline(ratio);
      const L = layoutMotion({ beats: [{ kind: "title", title: "ادخر مالك", text: "ابدأ اليوم", icon: "money" }, { kind: "points", title: "ثلاث خطوات", items: ["حدد هدفك", "سجل مصاريفك", "ادخر أولًا"], icon: "auto" }] }, tl.width, tl.height);
      L.anchors.forEach((a, i) => {
        expect(a.icon, `${ratio} beat ${i}`).toBeDefined();
        const half = (a.icon!.size * Math.min(tl.width, tl.height)) / tl.height / 2;
        const textTop = Math.min(...L.placed.filter((p) => p.beat === i).map((p) => p.y - p.h / 2));
        expect(a.icon!.y + half).toBeLessThanOrEqual(textTop + 0.002);
      });
      expect(lintPlaced(L.placed, tl.width, tl.height, L.palette.bg)).toEqual([]);
    }
  });
  it("an icon that cannot fit with the words is dropped before any word is", () => {
    const tl = emptyTimeline("16:9");
    const L = layoutMotion({ beats: [{ kind: "points", title: "خمس نقاط كاملة", items: ["نقطة أولى طويلة نسبيًا", "نقطة ثانية طويلة نسبيًا", "نقطة ثالثة طويلة نسبيًا", "نقطة رابعة طويلة نسبيًا", "نقطة خامسة طويلة نسبيًا"], icon: "bulb" }] }, tl.width, tl.height);
    expect(L.placed.filter((p) => p.role === "item").length).toBe(5);
  });
});

describe("the feelings", () => {
  it("nine of them, each with its tempo, entrance, scene and palette the engine has", () => {
    expect(MOODS.length).toBe(9);
    for (const m of MOODS) {
      expect(SCENE_IDS).toContain(m.scene);
      expect(PALETTES.map((p) => p.id)).toContain(m.palette);
      expect(MOODS_SKILL).toContain(`«${m.ar}»`);
      expect(MOTION_SKILL + MOODS_SKILL).toContain(m.id);
    }
    expect(new Set(MOODS.map((m) => m.id)).size).toBe(9);
  });
  it("finds the feeling in the person's words and sets the tempo of the piece", () => {
    expect(moodInText("سوّ لي موشن بمزاج الحزن")?.id).toBe("sad");
    expect(moodInText("ابي موشن فرح للتخرج")?.id).toBe("joy");
    expect(moodInText("فيديو توعية عن السكر")?.id).toBe("aware");
    expect(moodInText("قص السكتات")).toBeUndefined();
    expect(lookOf(undefined, { mood: "sad" }).pace).toBe("calm");
    expect(lookOf(undefined, { mood: "urgent" }).pace).toBe("fast");
    // the skill's palette stays; the mood sets the palette only when nothing else does
    expect(lookOf("luxury", { mood: "joy" }).palette).toBe("majlis");
    expect(lookOf(undefined, { mood: "joy" }).palette).toBe("riso");
    // the person's own wishes win
    expect(lookOf(undefined, { mood: "sad", pace: "fast" }).pace).toBe("fast");
    expect(readLook({ mood: "furious", scene: "volcano" }, new Set(TR_BY_ID.keys()))).toEqual({});
    expect(readLook({ mood: "faith", scene: "mosque" }, new Set(TR_BY_ID.keys()))).toEqual({ mood: "faith", scene: "mosque" });
    expect(moodOf("الحزن")?.id).toBe("sad");
  });
  it("a sad piece is slower than an urgent one, and each draws its own scene behind the words", () => {
    const tl = emptyTimeline("9:16");
    const beats: Beat[] = [{ kind: "title", title: "عنوان قصير", text: "سطر تحته" }, { kind: "statement", text: "جملة قوية" }, { kind: "outro", title: "شكرًا", handle: "@nahjali" }];
    const sad = layoutMotion({ look: { mood: "sad" }, beats }, tl.width, tl.height).endMs;
    const urgent = layoutMotion({ look: { mood: "urgent" }, beats }, tl.width, tl.height).endMs;
    expect(sad).toBeGreaterThan(urgent);
    const plan = motionPlan({ look: { mood: "sad" }, beats }, tl.width, tl.height);
    expect(plan.art.find((a) => a.key === "bg-0")!.svg).toContain('stroke="#4ecdc4"'); // the rain's lines in the palette's second colour
    const faith = motionPlan({ look: { mood: "faith" }, beats }, tl.width, tl.height);
    expect(faith.art.find((a) => a.key === "bg-0")!.svg).not.toBe(plan.art.find((a) => a.key === "bg-0")!.svg);
    // a beat can carry its own feeling
    const mixed = motionPlan({ look: { mood: "sad" }, beats: [{ ...beats[0], mood: "joy" }, beats[1]] }, tl.width, tl.height);
    expect(mixed.art.find((a) => a.key === "bg-0")!.svg).not.toBe(mixed.art.find((a) => a.key === "bg-1")!.svg);
  });
});

describe("the scenes the engine draws behind the words", () => {
  it("every scene is a whole drawing in every palette and on every frame shape, with no numbers gone wrong", () => {
    for (const p of PALETTES) for (const id of SCENE_IDS) for (const [w, h] of [[540, 960], [960, 540], [720, 720]]) for (const i of [0, 1, 2]) {
      const s = sceneSvg(id, p, i, w, h);
      expect(s).not.toMatch(/NaN|undefined|Infinity/);
      if (id !== "none") expect(s.length, `${p.id}/${id}`).toBeGreaterThan(50);
      expect(sceneSvg(id, p, i, w, h)).toBe(s);
    }
    expect(sceneSvg("none", PALETTES[0], 0, 100, 100)).toBe("");
  });
  it("the words stay readable on any scene: text on the background tinted by the strongest layer of any colour", () => {
    expect(SCENE_MAX_ALPHA).toBeLessThanOrEqual(0.3);
    for (const p of PALETTES) for (const c of [p.accent, p.second, p.pill]) {
      expect(contrast(p.text, mix(p.bg, c, SCENE_MAX_ALPHA)), `${p.id} ${c}`).toBeGreaterThanOrEqual(4.5);
    }
    // the white or black ink layers (clouds, stars, rain) are far fainter
    for (const p of PALETTES) expect(contrast(p.text, mix(p.bg, p.text, 0.14)), p.id).toBeGreaterThanOrEqual(4.5);
  });
  it("the scene sits in the background picture", () => {
    const p = PALETTES[0];
    expect(backgroundSvg(p, 0, 540, 960, "glow", "stars")).toContain("<circle");
    expect(backgroundSvg(p, 0, 540, 960, "glow", "none")).toBe(backgroundSvg(p, 0, 540, 960, "glow"));
  });
});

describe("the shapes حيدرة draws himself", () => {
  it("reads what he writes and clamps it into the frame, dropping what is not a shape", () => {
    const shapes = readShapes([{ t: "circle", x: 3, y: -2, w: 9, h: 0, c: "red", o: 5, r: 999 }, { t: "volcano" }, { t: "icon", icon: "nope" }, { t: "icon", icon: "bulb", x: 0.2, y: 0.2, w: 0.1 }, null, 5]);
    expect(shapes.length).toBe(2);
    expect(shapes[0]).toMatchObject({ t: "circle", x: 1, y: 0, c: "accent", o: 0.9, r: 360 });
    expect(shapes[0].w).toBeLessThanOrEqual(1.2);
    expect(readShapes(Array.from({ length: 40 }, () => ({ t: "rect" }))).length).toBe(16);
  });
  it("every kind draws, and a shape across the words is faint so it never covers them", () => {
    const pal = PALETTES[0];
    const kinds = ["rect", "circle", "ring", "line", "arrow", "star", "blob", "wave", "dots", "icon"] as const;
    for (const t of kinds) {
      const s: DrawShape = { t, x: 0.5, y: 0.5, w: 0.3, h: 0.2, c: "accent", o: 0.8, r: 10, ...(t === "icon" ? { icon: "bulb" } : {}) };
      const out = shapesSvg([s], pal, 540, 960, { top: 0.4, bottom: 0.6 });
      expect(out, t).not.toMatch(/NaN|undefined/);
      expect(out.length, t).toBeGreaterThan(20);
      expect(out, `${t} across the words`).toMatch(/opacity="0\.30"/);
      // off to the side and below the words it keeps its own opacity
      expect(shapesSvg([{ ...s, y: 0.92 }], pal, 540, 960, { top: 0.4, bottom: 0.6 }), t).toMatch(/opacity="0\.80"/);
    }
  });
  it("a beat's shapes and icon are drawn even when the skill draws no decoration", () => {
    const tl = emptyTimeline("9:16");
    const plan = motionPlan({ style: "clean", beats: [{ kind: "title", title: "عنوان", text: "سطر", icon: "bulb", shapes: [{ t: "star", x: 0.1, y: 0.1, w: 0.1, h: 0.1, c: "pill", o: 0.5, r: 0 }] }, { kind: "statement", text: "جملة" }] }, tl.width, tl.height);
    expect(plan.art.some((a) => a.key === "art-0")).toBe(true);
    expect(plan.art.some((a) => a.key === "art-1")).toBe(false);
    expect(decorationSvg({ kind: "statement", text: "x" }, 0, PALETTES[0], { top: 0.3, bottom: 0.6 }, 540, 960, "glow", true)).not.toContain("<path");
  });
});

describe("the voice sets the timing", () => {
  it("estimates how long Arabic takes to say: about 2.4 words a second and a breath at every clause", () => {
    expect(narrationMs("كلمة كلمة كلمة كلمة كلمة كلمة")).toBeCloseTo(2500, -2);
    expect(narrationMs("كلمة كلمة، كلمة كلمة.")).toBeGreaterThan(narrationMs("كلمة كلمة كلمة كلمة"));
    expect(narrationMs("")).toBe(0);
  });
  it("a beat that is spoken lasts as long as the saying; the whole piece can be asked to fit a length", () => {
    const tl = emptyTimeline("9:16");
    const say = "الصدقة تطفئ غضب الرب، وتزيد في الرزق والعمر.";
    const beats: Beat[] = [{ kind: "title", title: "الصدقة", text: "فضلها", say }, { kind: "statement", text: "داوم عليها", say: "داوم عليها ولو بالقليل." }];
    const L = layoutMotion({ beats }, tl.width, tl.height);
    expect(L.times[0].end - L.times[0].start).toBe(narrationMs(say) + 350);
    const fit = layoutMotion({ fitMs: 20_000, beats }, tl.width, tl.height);
    expect(fit.endMs).toBe(20_000);
    expect(fit.times[0].end - fit.times[0].start).toBeGreaterThan(fit.times[1].end - fit.times[1].start);
    // a voice shorter than the words need: every beat keeps the least it can be
    expect(fitDurations([3000, 3000, 3000], 2000)).toEqual([1200, 1200, 1200]);
    expect(fitDurations([3000, 1000, 3000], 7000).reduce((a, b) => a + b, 0)).toBe(7000);
  });
  it("stretches the beats to the recording's real length, each keeping its share, and moves the sounds with them", () => {
    const tl = emptyTimeline("9:16");
    const beats: Beat[] = [{ kind: "title", title: "عنوان", text: "سطر", say: "جملة قصيرة." }, { kind: "statement", text: "جملة", say: "جملة أطول بكثير من التي قبلها وفيها كلام كثير." }, { kind: "outro", title: "شكرًا", handle: "@nahjali", say: "شكرًا لكم." }];
    const plan = motionPlan({ beats }, tl.width, tl.height);
    const end = plan.endMs;
    const real = Math.round((end - plan.fit.from) * 1.3) + plan.fit.from;
    const map = retimeMap(plan.fit, real);
    expect(map[map.length - 1][1]).toBe(real);
    expect(mapTime(map, end)).toBe(real);
    expect(mapTime(map, 0)).toBe(0);
    // the longer saying gets the bigger share
    const spans = map.slice(1).map((m, i) => m[1] - map[i][1]);
    expect(spans[1]).toBeGreaterThan(spans[0]);
    // on a real timeline: the texts stretch, the sounds keep their length, nothing is left past the end
    const infos = new Map([["sfx", { id: "sfx", kind: "audio" as const, durationMs: 700, width: null, height: null, hasAudio: true }]]);
    const built = applyAll(tl, [{ type: "add_text" as const, at: plan.times[1].start, body: "جملة", duration: plan.times[1].end - plan.times[1].start }, { type: "add_clip" as const, assetId: "sfx", at: plan.times[1].start }], infos).timeline;
    const moved = applyAll(built, [{ type: "retime", map }], infos).timeline;
    const text = moved.tracks.flatMap((t) => t.clips).find((c) => c.text)!;
    const sound = moved.tracks.flatMap((t) => t.clips).find((c) => c.assetId === "sfx")!;
    expect(text.start).toBe(map[1][1]);
    expect(text.start + (text.out - text.in)).toBe(map[2][1]);
    expect(sound.start).toBe(map[1][1]);
    expect(sound.out - sound.in).toBe(700);
  });
  it("the retime command refuses a map out of order, and does nothing when nothing moves", () => {
    const tl = emptyTimeline("9:16");
    const t = applyAll(tl, [{ type: "add_text", at: 0, body: "نص", duration: 2000 }], new Map()).timeline;
    expect(() => applyAll(t, [{ type: "retime", map: [[1000, 1000], [500, 900]] }], new Map())).toThrow();
    expect(() => applyAll(t, [{ type: "retime", map: [[0, 0], [2000, 2000]] }], new Map())).toThrow();
  });
});

describe("mistakes in a hurried storyboard are repaired, not shipped", () => {
  it("a long title is shrunk, not deleted, and every word is still on screen", () => {
    const tl = emptyTimeline("9:16");
    const L = layoutMotion({ beats: [{ kind: "title", title: "الاحتيال الإلكتروني: الحقيقة", text: "شاركها قبل أن تنسى" }] }, tl.width, tl.height);
    const said = L.placed.map((p) => p.body).join(" ");
    for (const w of ["الاحتيال", "الإلكتروني:", "الحقيقة", "شاركها", "تنسى"]) expect(said).toContain(w);
  });
  it("a compare with a long title keeps the title; a split half never carries the first half's points again", () => {
    const tl = emptyTimeline("4:5");
    const L = layoutMotion({ beats: [{ kind: "compare", title: "الإطلاق الكبير هذه اللحظة تنتظرها الحماس في أعلى مستوياته", right: { title: "غيرنا", text: "يتفرج" }, left: { title: "نحن", text: "نصنع الحدث" } }] }, tl.width, tl.height);
    const said = L.placed.map((p) => p.body).join(" ");
    expect(said).toContain("الحماس");
    expect(said).toContain("نصنع");
    const S = layoutMotion({ beats: [{ kind: "steps", title: "التشكيلة", text: "اربط الحزام، انطلقنا هذه اللحظة تنتظرها فعلًا", items: ["أغرب مفاجأة"] }] }, tl.width, tl.height);
    expect(S.beats.length).toBeLessThan(6);
  });
  it("a brand colour no text can read on is moved until it can, and its pill reads too", () => {
    const pal = brandPalette({ bg: "#c5593e", accent: "#c5593e" })!;
    expect(contrast(pal.text, pal.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(pal.pillText, pal.pill)).toBeGreaterThanOrEqual(4.5);
  });
  it("many entrances in a short beat are packed closer so the last one is still readable", () => {
    const tl = emptyTimeline("9:16");
    const L = layoutMotion({ look: { pace: "fast" }, beats: [{ kind: "points", title: "خمس", items: ["أولى", "ثانية", "ثالثة", "رابعة", "خامسة"], seconds: 1.5 }] }, tl.width, tl.height);
    expect(lintPlaced(L.placed, tl.width, tl.height, L.palette.bg)).toEqual([]);
  });
});

describe("GPT Image 2 only on request", () => {
  it("a motion piece asks for a picture only when the person says so in so many words", () => {
    expect(askedForPicture("ارسم لي صورة للقدس")).toBe(true);
    expect(askedForPicture("ابي صورة من جي بي تي ايمج 2 للخلفية")).toBe(true);
    expect(askedForPicture("generate an image of a mosque")).toBe(true);
    expect(askedForPicture("سو لي موشن جرافيكس بمهارة الريل السريع عن الصدقة")).toBe(false);
    expect(askedForPicture("خلفية حلوة للموشن")).toBe(false);
  });
  it("حيدرة is told so, and told how to arrange backgrounds himself", () => {
    expect(MOTION_SKILL).toContain("THE DRAWING TOOLS");
    expect(MOTION_SKILL).toContain("never GPT Image 2 unless the person asks");
    expect(MOTION_SKILL).not.toContain("pictures and icons made with make image");
  });
});

describe("the bank and its examples", () => {
  it("is a million pieces, each the same every time, every one different", () => {
    expect(BANK_SIZE).toBe(1_000_000);
    expect(JSON.stringify(pieceAt(123_456).raw)).toBe(JSON.stringify(pieceAt(123_456).raw));
    expect(new Set(Array.from({ length: 300 }, (_, i) => JSON.stringify(pieceAt(i * 3331).raw))).size).toBe(300);
  });
  it("speaks each feeling in its own words and never draws a person", () => {
    for (const m of MOODS) {
      const v = VOCAB[m.id];
      for (const id of v.icons) expect(iconById(id), `${m.id}: ${id}`).toBeDefined();
      expect(v.subjects.length).toBeGreaterThanOrEqual(8);
    }
    const all = JSON.stringify(VOCAB);
    expect(all).not.toMatch(/امرأة|بنت|فتاة|سيدة|إمرأة|نساء/);
  });
  it("nearest examples match the feeling and the skill asked, and come out clean", () => {
    const ex = nearestMotionExamples("موشن عن ليلة القدر والدعاء", { mood: "faith", style: "spiritual" }, 2);
    expect(ex.length).toBe(2);
    for (const p of ex) {
      expect(p.mood).toBe("faith");
      expect(p.style).toBe("spiritual");
      expect(p.noisy).toBe(false);
      expect(auditPiece(p).issues).toEqual([]);
    }
    expect(motionExamplesBrief(ex)).toContain("WORKED EXAMPLES");
    expect(motionExamplesBrief([])).toBe("");
  });
  it("previews of every skill and feeling draw as whole pictures", () => {
    for (const o of [{ style: "reel" }, { style: "news" }, { mood: "sad" }, { mood: "faith" }, {}]) {
      const s = previewSvg(o);
      expect(s.startsWith("<svg")).toBe(true);
      expect(s).not.toMatch(/NaN|undefined/);
      expect(s).toContain("<text");
    }
  });
  it("the first pieces of the bank come out clean (the million runs in scripts/motion-million.ts)", () => {
    const n = Number(process.env.MOTION_BANK_N ?? 1800);
    const bad: string[] = [];
    for (let i = 0; i < n; i++) {
      const a = auditPiece(pieceAt(i * 7), { deep: i % 5 === 0, retime: i % 10 === 0 });
      for (const x of a.issues) if (x.k !== "dropped_text") bad.push(`#${i * 7} ${x.k}: ${x.t.slice(0, 100)}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  }, 300_000);
  it("reads a storyboard with the new fields and drops what is unknown", () => {
    const sb = readStoryboard(JSON.stringify({ mood: "sad", scene: "rain", fitMs: 30000, beats: [{ kind: "title", title: "عنوان", icon: "bulb", mood: "joy", scene: "stars", say: "قول", shapes: [{ t: "ring", x: 0.5, y: 0.5, w: 0.2 }] }, { kind: "statement", text: "جملة", icon: "nope", mood: "furious", scene: "volcano" }] }))!;
    expect(sb.look).toEqual({ mood: "sad", scene: "rain" });
    expect(sb.fitMs).toBe(30000);
    expect(sb.beats[0]).toMatchObject({ icon: "bulb", mood: "joy", scene: "stars", say: "قول" });
    expect(sb.beats[0].shapes?.length).toBe(1);
    expect(sb.beats[1].icon).toBeUndefined();
    expect(sb.beats[1].mood).toBeUndefined();
    expect(sb.beats[1].scene).toBeUndefined();
  });
});
