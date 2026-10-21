import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARTOON_CHOICES, cartoonStyleLabel, CARTOON_PLACES, cartoonParts, cartoonPlaceSheetPrompt, CARTOON_GROUPS, CARTOON_PICTURE_DIR, cartoonStylePicturePrompt, CARTOON_PRICE, CARTOON_STYLES, CARTOON_VIDEO, CARTOON_VIDEO_SETTINGS, cartoonInput, cartoonImagePrompt, cartoonVideoPrompt, cartoonVideoSettings, movementAsked, nearestAspect } from "@config/jawad/cartoon";
import { generatorById } from "@config/jawad/generators";
import { evaluate } from "@/lib/jawad/engine";
import { DEFAULT_SECTIONS, sectionPath, RESERVED_SECTION_IDS } from "@config/jawad/sections";
const input = { style: "stylistic-drift", audience: "child", age: "baby", movement: "crawl", outfit: "بدلة فضاء", interests: "", story: "garden", customStory: "", count: 2, video: true, consent: true };
describe("cartoon journey", () => {
  it("requires valid choices and explicit consent", () => {
    expect(() => cartoonInput({ ...input, consent: false })).toThrow();
    expect(() => cartoonInput({ ...input, count: 0 })).toThrow();
    expect(() => cartoonInput({ ...input, count: 5 })).toThrow();
    expect(() => cartoonInput({ ...input, age: "toString" })).toThrow();
    expect(() => cartoonInput({ ...input, story: "custom" })).toThrow();
    expect(cartoonInput(input)).toMatchObject({ age: "baby", movement: "crawl", count: 2, audience: "child" });
    // a run saved before the audience question existed still works, as «للعائلة»
    expect(cartoonInput({ ...input, audience: undefined })).toMatchObject({ audience: "family" });
    expect(cartoonInput({ ...input, audience: "toString" })).toMatchObject({ audience: "family" });
  });
  it("retains identity and independent age/mobility across all prompts", () => {
    const clean = cartoonInput(input);
    expect(cartoonImagePrompt(clean)).toContain("SAME ONE PERSON");
    expect(cartoonImagePrompt(clean)).toContain("hands and knees");
    expect(cartoonImagePrompt(clean, true)).toContain("canonical CARTOON");
    expect(cartoonVideoPrompt(clean)).toContain("@character");
    expect(cartoonVideoPrompt(clean)).toContain("15 seconds");
    expect(cartoonVideoPrompt(clean)).toContain("No age or style morph");
    expect(CARTOON_PRICE).toBe(200);
  });
  it("offers a routable section and supported 15-second settings", () => {
    expect(sectionPath(DEFAULT_SECTIONS.find(section => section.id === "cartoon")!)).toBe("/jawad-ai/cartoon");
    expect(RESERVED_SECTION_IDS).toContain("cartoon");
    const def = generatorById(CARTOON_VIDEO)!;
    const prices = Object.fromEntries(def.priceKeys.map(rule => [rule.key, rule.defaultCenti]));
    const result = evaluate(def, { settings: CARTOON_VIDEO_SETTINGS, prompt: cartoonVideoPrompt(cartoonInput(input)), instructions: "", refs: [], refStyle: "none", strict: true }, prices);
    expect(result.issues).toEqual([]);
    expect(result.settings.duration).toBe(15);
    expect(result.price.ok).toBe(true);
  });
});
describe("the looks, and who the picture is for", () => {
  it("keeps «أنمي معتدل», and every look is a whole look that holds one level of stylisation", () => {
    expect(CARTOON_STYLES.find(style => style.id === "anime")?.name).toBe("أنمي معتدل");
    expect(CARTOON_STYLES.length).toBeGreaterThanOrEqual(10);
    const ids = CARTOON_STYLES.map(style => style.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const style of CARTOON_STYLES) {
      // a named, reproducible look: line, shading, texture, palette or light — not a one-word label
      expect(style.text.length).toBeGreaterThan(160);
      expect(style.real.length).toBeGreaterThan(20);
      expect(style.hint.length).toBeGreaterThan(4);
      expect(style.icon.length).toBeGreaterThan(0);
      expect(["child", "all", "grown"]).toContain(style.fits);
    }
    // the looks are far apart: no two share their opening words
    const openings = CARTOON_STYLES.map(style => style.text.split(":")[0]);
    expect(new Set(openings).size).toBe(openings.length);
  });

  it("writes the identity rules image models get wrong, and never mixes levels of realism", () => {
    const prompt = cartoonImagePrompt(cartoonInput({ ...input, style: "soft-2d" }));
    for (const rule of ["PRIORITY 1 — THE STYLE, COMPLETELY", "HOLD ONE LEVEL OF STYLISATION", "REDESIGN the person entirely", "Nothing of the photograph survives", "PRIORITY 2 — THE LIKENESS, INSIDE THE STYLE", "the style wins", "glasses", "freckles"]) expect(prompt).toContain(rule);
    // the style comes before the likeness, and nothing holds the photograph's own realism any more
    expect(prompt.indexOf("PRIORITY 1")).toBeLessThan(prompt.indexOf("PRIORITY 2"));
    for (const old of ["DO NOT BEAUTIFY", "do not shrink the nose", "do not enlarge the eyes"]) expect(prompt).not.toContain(old);
    expect(prompt).toContain("Modern 2D television animation");
  });
  it("offers only three looks — 3D, 2D and أنمي — and refuses the rest for a new run", () => {
    expect(CARTOON_CHOICES.map(choice => [choice.id, choice.label])).toEqual([["stylistic-drift", "3D"], ["soft-2d", "2D"], ["game-2-5d", "أنمي"]]);
    for (const choice of CARTOON_CHOICES) expect(cartoonInput({ ...input, style: choice.id }).style).toBe(choice.id);
    expect(() => cartoonInput({ ...input, style: "anime" })).toThrow("3D");
    expect(cartoonStyleLabel("game-2-5d")).toBe("أنمي");
    // a run made before keeps its look's name
    expect(cartoonStyleLabel("anime")).toBe("أنمي معتدل");
    expect(cartoonImagePrompt(cartoonInput(input))).toContain("stylistic-drift look");
  });

  it("asks who the picture is FOR, and that changes the drawing", () => {
    const child = cartoonImagePrompt(cartoonInput({ ...input, audience: "child" }));
    const grown = cartoonImagePrompt(cartoonInput({ ...input, audience: "grown" }));
    expect(child).toContain("Made FOR A CHILD");
    expect(grown).toContain("Made FOR GROWN-UPS");
    expect(child).not.toBe(grown);
    // the research's own finding: a nudge towards childlike proportions, never a balloon head, and the real face kept
    expect(child).toContain("a nudge, NOT a balloon head");
    expect(child).toContain("the person still recognisable");
    expect(grown).toContain("seven and a half heads");
    // and the audience reaches the film too
    expect(cartoonVideoPrompt(cartoonInput({ ...input, audience: "child" }))).toContain("Made FOR A CHILD");
  });
});

describe("the photograph itself, redrawn", () => {
  const scene = cartoonInput({ ...input, mode: "scene", aspect: "3:2", age: "adult", movement: "crawl" });

  it("keeps the picture's own shape, and only the listed shapes", () => {
    expect(scene.aspect).toBe("3:2");
    expect(cartoonInput({ ...input, aspect: "5:4" }).aspect).toBe("9:16");
    expect(nearestAspect(4032, 3024)).toBe("3:2");
    expect(nearestAspect(1080, 1920)).toBe("9:16");
    expect(nearestAspect(1000, 1000)).toBe("1:1");
    expect(nearestAspect(0, 0)).toBe("9:16");
    // the film follows it too
    expect(cartoonVideoSettings(scene).ratio).toBe("16:9");
    expect(cartoonVideoSettings(cartoonInput({ ...input, mode: "character" })).ratio).toBe("9:16");
  });

  it("redraws everyone in it, each with their own face, and changes nothing else", () => {
    const prompt = cartoonImagePrompt(scene);
    expect(prompt).toContain("REDRAW THE PHOTOGRAPH ITSELF");
    expect(prompt).toContain("EVERY PERSON in the photograph");
    expect(prompt).toContain("never merge two people");
    expect(prompt).toContain("never give two of them the same face");
    expect(prompt).toContain("Keep their real difference in age and in height");
    expect(prompt).toContain("KEEP THE PICTURE");
    // nothing about a new pose, a new age or a chosen outfit
    expect(prompt).not.toContain("An age change");
    expect(prompt).not.toContain("OUTFIT:");
    expect(prompt).not.toContain("hands and knees");
    // the identity rules still hold, for each of them
    expect(prompt).toContain("PRIORITY 1 — THE STYLE");
    expect(prompt).toContain("FULLY REDRAWN in the style");
    expect(prompt).toContain("apply to EACH person");
    // the follow-up picture keeps the same scene
    expect(cartoonImagePrompt(scene, true)).toContain("the same scene again");
  });

  it("gives the film movement instead of a story", () => {
    const film = cartoonVideoPrompt(scene);
    expect(film).toContain("coming gently to life");
    expect(film).toContain("Nothing new happens");
    expect(film).not.toContain("Story:");
    expect(film).not.toContain("luminous flower");
  });

  it("never asks a grown-up how they move", () => {
    expect(movementAsked({ mode: "character", age: "baby" })).toBe(true);
    expect(movementAsked({ mode: "character", age: "child" })).toBe(true);
    expect(movementAsked({ mode: "character", age: "adult" })).toBe(false);
    expect(movementAsked({ mode: "character", age: "same" })).toBe(false);
    expect(movementAsked({ mode: "scene", age: "baby" })).toBe(false);
    const grown = cartoonImagePrompt(cartoonInput({ ...input, mode: "character", age: "adult", movement: "crawl" }));
    expect(grown).not.toContain("MOVEMENT:");
    expect(grown).not.toContain("hands and knees");
    // and the child's baby film still gets its movement
    expect(cartoonVideoPrompt(cartoonInput({ ...input, mode: "character", age: "baby", movement: "crawl" }))).toContain("hands and knees");
  });
});

describe("the games, anime and kids shelves, and the looks' pictures", () => {
  it("has a 2.5D game look and several anime looks, every look on a known shelf", () => {
    const ids = CARTOON_STYLES.map(style => style.id);
    for (const id of ["game-2-5d", "pixel", "voxel", "anime-action", "anime-sky", "retro-anime", "chibi", "vinyl-toy", "felt"]) expect(ids).toContain(id);
    expect(CARTOON_STYLES.find(style => style.id === "game-2-5d")?.name).toBe("لعبة 2.5D");
    expect(CARTOON_STYLES.length).toBe(22);
    for (const style of CARTOON_STYLES) expect(Object.keys(CARTOON_GROUPS)).toContain(style.group);
    // every shelf has looks, and anime has several
    for (const group of Object.keys(CARTOON_GROUPS)) expect(CARTOON_STYLES.some(style => style.group === group)).toBe(true);
    expect(CARTOON_STYLES.filter(style => style.group === "anime").length).toBeGreaterThanOrEqual(6);
  });
  it("a new look builds a prompt, and its picture is a made-up character, never drawn by itself", () => {
    const prompt = cartoonImagePrompt(cartoonInput({ ...input, style: "game-2-5d" }));
    expect(prompt).toContain("2.5D video-game art");
    const picture = cartoonStylePicturePrompt("pixel");
    expect(picture).toContain("made-up");
    expect(picture).toContain("16-bit pixel art");
    expect(CARTOON_PICTURE_DIR).toBe("cartoon-styles");
    // drawn only from the owner's button in /admin/film, and the page shows a tile until then
    const route = readFileSync(new URL("../../src/app/api/jawad/cartoon-styles/route.ts", import.meta.url), "utf8");
    expect(route).toContain("isAdmin(user.email)");
    const studio = readFileSync(new URL("../../src/components/jawad/cartoon/CartoonStudio.tsx", import.meta.url), "utf8");
    expect(studio).toContain("ct-tile");
    expect(studio).toContain("/api/jawad/cartoon-styles");
    expect(readFileSync(new URL("../../src/app/admin/film/page.tsx", import.meta.url), "utf8")).toContain("CartoonPictures");
  });
  it("the page is a child's: doodles in the back and motion that respects the device's setting", () => {
    const css = readFileSync(new URL("../../src/app/jawad-ai/cartoon/cartoon.css", import.meta.url), "utf8");
    expect(css).toContain(".ct-sky");
    expect(css).toContain("prefers-reduced-motion");
    expect(readFileSync(new URL("../../src/components/jawad/cartoon/Doodles.tsx", import.meta.url), "utf8")).toContain('aria-hidden="true"');
  });
  it("films a character in a chosen place, part after part, in the same look, with no Arabic reaching Seedance 2.0", () => {
    const base = { ...input, audience: "child", age: "child", movement: "walk", story: "custom", video: true, place: "playground", count: 1 };
    expect(() => cartoonInput({ ...base, scenes: [] })).toThrow("١٥");
    expect(() => cartoonInput({ ...base, scenes: ["يلعب كورة", "", "يضحك"] })).toThrow();
    const clean = cartoonInput({ ...base, mode: "sheet", scenes: ["يلعب كورة ويسجل هدف", "يحتفل مع أصحابه", ""] });
    expect(clean).toMatchObject({ mode: "sheet", video: true, place: "playground", aspect: "16:9" });
    expect(clean.scenes).toHaveLength(2);
    expect(cartoonParts(clean)).toBe(2);
    expect(cartoonParts({ ...clean, mode: "scene" })).toBe(1);
    expect(cartoonParts({ ...clean, video: false })).toBe(0);
    const style = CARTOON_STYLES.find(item => item.id === clean.style)!;
    for (const part of [0, 1]) {
      const prompt = cartoonVideoPrompt(clean, part, true);
      expect(prompt).not.toMatch(/[\u0600-\u06FF]/);
      expect(prompt).toContain(style.text);
      expect(prompt).toContain("@place");
      expect(prompt).toContain("part " + (part + 1) + " of 2");
    }
    // the director's prompt is used, and @place leaves it when the place has no sheet yet
    const directed = { ...clean, directed: ["Seedance film: @character kicks the ball across @place.", ""] };
    expect(cartoonVideoPrompt(directed, 0, true)).toContain("kicks the ball across @place");
    expect(cartoonVideoPrompt(directed, 0, false)).not.toContain("@place");
    const def = generatorById(CARTOON_VIDEO)!;
    const prices = Object.fromEntries(def.priceKeys.map(rule => [rule.key, rule.defaultCenti]));
    expect(evaluate(def, { settings: CARTOON_VIDEO_SETTINGS, prompt: cartoonVideoPrompt(clean, 1, false), instructions: "", refs: [], refStyle: "none", strict: true }, prices).issues).toEqual([]);
    expect(Object.keys(CARTOON_PLACES)).toEqual(["house", "garden", "playground"]);
    expect(cartoonPlaceSheetPrompt("house", clean.style)).toContain(style.text);
  });
  it("takes an optional approximate height and weight into the character, and makes a sheet from one photo too", () => {
    const clean = cartoonInput({ ...input, mode: "sheet", heightCm: "120", weightKg: 25 });
    expect(clean).toMatchObject({ heightCm: 120, weightKg: 25 });
    expect(cartoonImagePrompt(clean)).toContain("about 120 cm tall, about 25 kg");
    expect(cartoonImagePrompt(clean)).toContain("single photograph");
    expect(cartoonInput({ ...input, heightCm: "", weightKg: 9999 })).toMatchObject({ heightCm: null, weightKg: null });
    expect(cartoonImagePrompt(cartoonInput(input))).not.toContain("BUILD");
    expect(cartoonInput({ ...input, mode: "scene", heightCm: 150 })).toMatchObject({ heightCm: null });
  });
});
