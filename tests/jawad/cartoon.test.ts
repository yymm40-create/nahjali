import { describe, expect, it } from "vitest";
import { CARTOON_PRICE, CARTOON_STYLES, CARTOON_VIDEO, CARTOON_VIDEO_SETTINGS, cartoonInput, cartoonImagePrompt, cartoonVideoPrompt } from "@config/jawad/cartoon";
import { DEFAULT_SETTINGS, OCTOBER_OFFER, offersAt, offerFor } from "@config/course";
import { generatorById } from "@config/jawad/generators";
import { evaluate } from "@/lib/jawad/engine";
import { DEFAULT_SECTIONS, sectionPath, RESERVED_SECTION_IDS } from "@config/jawad/sections";
const input = { style: "cinematic-3d", audience: "child", age: "baby", movement: "crawl", outfit: "بدلة فضاء", interests: "", story: "garden", customStory: "", count: 2, video: true, consent: true };
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
    expect(cartoonVideoPrompt(clean)).toContain("30 seconds");
    expect(cartoonVideoPrompt(clean)).toContain("No age or style morph");
    expect(CARTOON_PRICE).toBe(200);
  });
  it("offers a routable section and supported 30-second settings", () => {
    expect(sectionPath(DEFAULT_SECTIONS.find(section => section.id === "cartoon")!)).toBe("/jawad-ai/cartoon");
    expect(RESERVED_SECTION_IDS).toContain("cartoon");
    const def = generatorById(CARTOON_VIDEO)!;
    const prices = Object.fromEntries(def.priceKeys.map(rule => [rule.key, rule.defaultCenti]));
    const result = evaluate(def, { settings: CARTOON_VIDEO_SETTINGS, prompt: cartoonVideoPrompt(cartoonInput(input)), instructions: "", refs: [], refStyle: "none", strict: true }, prices);
    expect(result.issues).toEqual([]);
    expect(result.settings.duration).toBe(30);
    expect(result.price.ok).toBe(true);
  });
});
describe("October course offer", () => {
  it("activates independently of old stored launch settings, with exact products", () => {
    const active = offersAt(DEFAULT_SETTINGS, OCTOBER_OFFER.startsAt);
    expect(active.offers.map(offer => [offer.product, offer.price])).toEqual([["live", 50], ["combo", 80]]);
    expect(active.endsAt).toBe(Date.parse("2026-10-15T13:00:00Z"));
    expect(offerFor(DEFAULT_SETTINGS, "recorded", OCTOBER_OFFER.startsAt)).toBeNull();
  });
  it("ends exactly at 4pm Saudi time and keeps configured gift amount", () => {
    expect(offersAt(DEFAULT_SETTINGS, OCTOBER_OFFER.endsAt - 1).offers).toHaveLength(2);
    expect(offersAt(DEFAULT_SETTINGS, OCTOBER_OFFER.endsAt).offers).toEqual([]);
    const settings = { ...DEFAULT_SETTINGS, launchAt: "2026-10-01T00:00:00Z", bonus: { ...DEFAULT_SETTINGS.bonus, comboA: 15 } };
    expect(offerFor(settings, "combo", OCTOBER_OFFER.startsAt)?.bonus).toBe(15);
    expect(offerFor(settings, "live", OCTOBER_OFFER.endsAt)?.price).toBe(settings.prices.liveC);
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
    const prompt = cartoonImagePrompt(cartoonInput({ ...input, style: "anime" }));
    for (const rule of ["HOLD ONE LEVEL OF STYLISATION", "DO NOT BEAUTIFY", "do not smooth the skin", "do not slim or lengthen the face", "do not straighten the teeth", "glasses", "freckles", "the references are the identity, not the rendering"]) expect(prompt).toContain(rule);
    expect(prompt).toContain("Moderate anime cel work");
  });

  it("asks who the picture is FOR, and that changes the drawing", () => {
    const child = cartoonImagePrompt(cartoonInput({ ...input, audience: "child" }));
    const grown = cartoonImagePrompt(cartoonInput({ ...input, audience: "grown" }));
    expect(child).toContain("Made FOR A CHILD");
    expect(grown).toContain("Made FOR GROWN-UPS");
    expect(child).not.toBe(grown);
    // the research's own finding: a nudge towards childlike proportions, never a balloon head, and the real face kept
    expect(child).toContain("a nudge, NOT a balloon head");
    expect(child).toContain("never at the cost of the real face");
    expect(grown).toContain("seven and a half heads");
    // and the audience reaches the film too
    expect(cartoonVideoPrompt(cartoonInput({ ...input, audience: "child" }))).toContain("Made FOR A CHILD");
  });
});
