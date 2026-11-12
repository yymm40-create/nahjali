import { describe, expect, it } from "vitest";
import { GENERATORS, generatorById, hasArabic } from "@config/jawad/generators";
import { PLAYBOOKS } from "@config/jawad/playbooks";
import { composeReady, composerSideOf, fitSettings, missingInput, pickReadyGenerator, playbooksWithoutCard, READY_APPS, readyAppById, readyValues, suits, visibleInputs, type ReadyApp, type ReadyValues } from "@config/jawad/ready-apps";
import { findStyle } from "@config/film-styles";
import { evaluate } from "@/lib/jawad/engine";
import { findMentions } from "@/lib/jawad/mentions";

// «جاهز بضغطة»: each playbook as a card that fills the studio's form with no AI call. The prompt is written from the
// playbook and the person's inputs, the generator is one this account has, and the form is one the studio can send.
const ALL = GENERATORS.map((g) => ({ id: g.id, usable: true }));

/** The person's inputs, every text filled with Arabic words (what people type). */
const filled = (app: ReadyApp): ReadyValues => Object.fromEntries(app.inputs.map((i) => [i.key, i.kind === "text" ? `كلمة${i.key}` : i.choices.at(-1)!.value]));
/** Only what a card needs: required texts filled, everything else left out. */
const bare = (app: ReadyApp): ReadyValues => Object.fromEntries(app.inputs.flatMap((i) => (i.kind === "text" && !i.optional ? [[i.key, "عنوان"]] : [])));

describe("ready cards", () => {
  it("every playbook has a card with a name, a line, what to add and at most three inputs", () => {
    expect(playbooksWithoutCard()).toEqual([]);
    expect(READY_APPS.map((a) => a.id).sort()).toEqual(PLAYBOOKS.map((p) => p.id).sort());
    for (const a of READY_APPS) {
      expect(a.name.length, a.id).toBeGreaterThan(3);
      expect(a.line.length, a.id).toBeGreaterThan(10);
      expect(a.needs.length, a.id).toBeGreaterThan(2);
      expect(a.inputs.length, a.id).toBeGreaterThanOrEqual(1);
      expect(a.inputs.length, a.id).toBeLessThanOrEqual(3);
      expect(a.prefer.every((id) => generatorById(id)?.output === a.output), a.id).toBe(true);
      for (const i of a.inputs) if (i.kind === "choice") expect(new Set(i.choices.map((c) => c.value)).size, `${a.id} ${i.key}`).toBe(i.choices.length);
    }
  });

  it("compose a non-empty prompt with and without the optional inputs, for every choice", () => {
    for (const a of READY_APPS) {
      const variants: ReadyValues[] = [{}, bare(a), filled(a)];
      for (const i of a.inputs) if (i.kind === "choice") for (const c of i.choices) variants.push({ ...filled(a), [i.key]: c.value }, { ...bare(a), [i.key]: c.value });
      for (const v of variants) {
        const f = composeReady(a, v);
        expect(f.prompt.length, `${a.id} ${JSON.stringify(v)}`).toBeGreaterThan(120);
        expect(f.prompt, a.id).not.toMatch(/undefined|null|NaN|\[object|""/);
        expect(f.output).toBe(a.output);
        // every slot is mentioned in the prompt, and the prompt mentions nothing else
        const named = new Set(findMentions(f.prompt).map((m) => m.name));
        expect([...named].sort(), a.id).toEqual(f.slots.map((s) => s.name).sort());
        expect(f.refStyle === "none", a.id).toBe(f.slots.length === 0);
        if (f.styleId) expect(findStyle(f.styleId), f.styleId).toBeTruthy();
      }
    }
  });

  it("is the same every time (no AI, nothing random)", () => {
    for (const a of READY_APPS) expect(composeReady(a, filled(a))).toEqual(composeReady(a, filled(a)));
  });

  it("puts the person's own words in the prompt", () => {
    for (const a of READY_APPS) {
      const v = filled(a);
      const f = composeReady(a, v);
      for (const i of visibleInputs(a, readyValues(a, v))) if (i.kind === "text") expect(f.prompt, `${a.id} ${i.key}`).toContain(`"كلمة${i.key}"`);
      expect(hasArabic(f.prompt), a.id).toBe(a.inputs.some((i) => i.kind === "text"));
    }
    const f = composeReady(readyAppById("thumbnail")!, { title: "وين تروح فلوسك؟", shape: "youtube" });
    expect(f.prompt).toContain('"وين تروح فلوسك؟"');
    expect(f.settings.aspect).toBe("16:9");
    expect(composeReady(readyAppById("thumbnail")!, { title: "x", shape: "reel" }).settings.aspect).toBe("9:16");
    // a quote typed by the person cannot break out of its quotes
    expect(composeReady(readyAppById("poster-social")!, { headline: 'خصم "كبير"' }).prompt).toContain(`"خصم 'كبير'"`);
  });

  it("keeps the playbook's options and adds the chosen shape and sound", () => {
    const hm = composeReady(readyAppById("hyper-motion")!, { shape: "wide" });
    expect(hm.settings).toMatchObject({ ratio: "16:9", resolution: "1080p", duration: 8, audio: true });
    expect(hm.prompt).toContain("8 seconds");
    expect(composeReady(readyAppById("viral-effect")!, { sound: "off" }).settings.audio).toBe(false);
    expect(composeReady(readyAppById("product-shot")!, {}).settings).toMatchObject({ aspect: "1:1", quality: "high", resolution: "hi" });
  });

  it("shows a choice only when the choice it depends on is picked", () => {
    const a = readyAppById("product-shot")!;
    expect(visibleInputs(a, readyValues(a, { use: "listing" })).map((i) => i.key)).not.toContain("mood");
    expect(visibleInputs(a, readyValues(a, { use: "ad" })).map((i) => i.key)).toContain("mood");
    expect(composeReady(a, { use: "listing" }).prompt).toContain("pure white seamless background");
  });

  it("asks for a required text and trims what is typed", () => {
    const a = readyAppById("poster-social")!;
    expect(missingInput(a, readyValues(a, {}))?.key).toBe("headline");
    expect(missingInput(a, readyValues(a, { headline: "  خصم ٥٠٪  " }))).toBeNull();
    expect(readyValues(a, { headline: "ا".repeat(200) }).headline.length).toBe(30);
    expect(readyValues(a, { shape: "nonsense" }).shape).toBe("story");
  });

  it("names the side left empty for a thumbnail", () => {
    expect(composerSideOf(readyAppById("thumbnail")!, { shape: "youtube" })).toBe("left");
    expect(composerSideOf(readyAppById("thumbnail")!, { shape: "reel" })).toBe("center");
    expect(composerSideOf(readyAppById("product-shot")!, {})).toBeNull();
  });
});

describe("the generator a card uses", () => {
  it("is the card's first choice when the account has every generator, and a form the studio can send", () => {
    for (const a of READY_APPS) {
      const f = composeReady(a, filled(a));
      const id = pickReadyGenerator(a, f, ALL);
      expect(id, a.id).toBe(a.prefer[0]);
      const def = generatorById(id!)!;
      const settings = fitSettings(def, f.settings);
      expect(f.prompt.length, a.id).toBeLessThanOrEqual(def.prompt.max);
      // with its references added, nothing stops the generation but the person's own choices
      const refs = f.slots.map((s, n) => ({ id: `r${n}`, kind: s.kind, role: s.role ?? "reference", name: s.name, mime: s.kind === "video" ? "video/mp4" : "image/png", bytes: 1e6, width: 1080, height: 1920, durationMs: s.kind === "video" ? 6000 : null, fps: s.kind === "video" ? 30 : null, status: "ready" as const }));
      const ev = evaluate(def, { settings, prompt: f.prompt, instructions: "", refStyle: f.refStyle, refs }, {});
      expect(ev.issues.filter((i) => i.field !== "price").map((i) => i.message), a.id).toEqual([]);
      expect(ev.mode.refStyle, a.id).toBe(f.refStyle);
    }
  });

  it("falls back to a same-kind generator when the preferred ones are hidden", () => {
    for (const a of READY_APPS) {
      const f = composeReady(a, filled(a));
      const without = ALL.map((g) => ({ ...g, usable: !a.prefer.includes(g.id) }));
      const id = pickReadyGenerator(a, f, without);
      if (!id) continue;
      expect(a.prefer, a.id).not.toContain(id);
      const def = generatorById(id)!;
      expect(def.output, a.id).toBe(a.output);
      expect(suits(def, f), a.id).toBe(true);
    }
    // the product shot without GPT Image: the next one it prefers
    const shot = readyAppById("product-shot")!;
    const f = composeReady(shot, {});
    expect(pickReadyGenerator(shot, f, ALL.map((g) => ({ ...g, usable: g.id !== "openai-gpt-image-2" })))).toBe("openai-gpt-image-2-6");
    // only Flux left (an image generator the card doesn't name): it is used
    expect(pickReadyGenerator(shot, f, [{ id: "bfl-flux-2-pro", usable: true }, { id: "byteplus-seedance-2-5", usable: true }])).toBe("bfl-flux-2-pro");
  });

  it("prefers one that reads Arabic when the person wrote Arabic", () => {
    const a = readyAppById("hyper-motion")!;
    const f = composeReady(a, { product: "عصير" });
    const gens = [{ id: "byteplus-seedance-2-0", usable: true }, { id: "kling-4", usable: true }, { id: "wan-3-0", usable: true }];
    // Seedance 2.0 refuses Arabic in the prompt; Wan reads it
    expect(pickReadyGenerator(a, f, gens)).toBe("wan-3-0");
    expect(pickReadyGenerator(a, composeReady(a, {}), gens)).toBe("byteplus-seedance-2-0");
  });

  it("never picks another kind, a generator that can't take the references, or a hidden one", () => {
    const viral = readyAppById("viral-effect")!;
    const f = composeReady(viral, {});
    expect(pickReadyGenerator(viral, f, [{ id: "openai-gpt-image-2", usable: true }])).toBeNull();
    // an editor needs a video; a first-frame card is not its kind of work
    expect(pickReadyGenerator(viral, f, [{ id: "kling-4-edit", usable: true }])).toBeNull();
    expect(pickReadyGenerator(viral, f, [{ id: "byteplus-seedance-2-5", usable: false }])).toBeNull();
    // the clip of «تحويل فيديو» needs a generator that takes a video reference
    const tr = readyAppById("video-transform")!;
    expect(pickReadyGenerator(tr, composeReady(tr, { to: "سطح" }), [{ id: "kling-3-pro", usable: true }])).toBeNull();
  });

  it("fits the options to the generator it lands on", () => {
    const flux = generatorById("bfl-flux-2-pro")!;
    expect(fitSettings(flux, { aspect: "2:3", quality: "high" })).toEqual({ aspect: "3:4", count: 1 });
    const kling = generatorById("kling-3-pro")!;
    expect(fitSettings(kling, { ratio: "21:9", duration: 40, audio: false, resolution: "1080p" })).toEqual({ ratio: "16:9", duration: 15, audio: false });
  });
});
