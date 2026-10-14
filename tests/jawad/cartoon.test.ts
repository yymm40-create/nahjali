import { describe, expect, it } from "vitest";
import { CARTOON_PRICE, CARTOON_VIDEO, CARTOON_VIDEO_SETTINGS, cartoonInput, cartoonImagePrompt, cartoonVideoPrompt } from "@config/jawad/cartoon";
import { DEFAULT_SETTINGS, OCTOBER_OFFER, offersAt, offerFor } from "@config/course";
import { generatorById } from "@config/jawad/generators";
import { evaluate } from "@/lib/jawad/engine";
import { DEFAULT_SECTIONS, sectionPath, RESERVED_SECTION_IDS } from "@config/jawad/sections";
const input = { style: "cinematic-3d", age: "baby", movement: "crawl", outfit: "بدلة فضاء", interests: "", story: "garden", customStory: "", count: 2, video: true, consent: true };
describe("cartoon journey", () => {
  it("requires valid choices and explicit consent", () => {
    expect(() => cartoonInput({ ...input, consent: false })).toThrow();
    expect(() => cartoonInput({ ...input, count: 0 })).toThrow();
    expect(() => cartoonInput({ ...input, count: 5 })).toThrow();
    expect(() => cartoonInput({ ...input, age: "toString" })).toThrow();
    expect(() => cartoonInput({ ...input, story: "custom" })).toThrow();
    expect(cartoonInput(input)).toMatchObject({ age: "baby", movement: "crawl", count: 2 });
  });
  it("retains identity and independent age/mobility across all prompts", () => {
    const clean = cartoonInput(input);
    expect(cartoonImagePrompt(clean)).toContain("ONE person");
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

