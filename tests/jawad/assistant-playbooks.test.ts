import { describe, expect, it } from "vitest";
import { GENERATORS, generatorById } from "@config/jawad/generators";
import { ASSISTANT_SCHEMA, checkAnswer, drawsRealWoman, WOMEN_RULE, assistantSystem } from "@config/jawad/assistant";
import { PLAYBOOKS, detectPlaybook, playbookGuide, playbooksBrief } from "@config/jawad/playbooks";
import { EXAMPLES_PER_PLAYBOOK, examplesFor, nearestExamples } from "@config/jawad/playbook-examples";
import { JAWAD_KNOWLEDGE } from "@config/jawad/knowledge";
import { evaluate } from "@/lib/jawad/engine";
import type { Settings } from "@config/jawad/types";

// «جواد» learns the ten kinds of work from a thousand worked examples each. Every example has to be one the form
// can take as it is (a generator of that studio, options that exist with valid values, a prompt within the limit),
// has to be recognised as its own kind from its request alone, and must respect the site's rule: no real women.
const STUDIO_GENERATOR = { image: "openai-gpt-image-2", video: "byteplus-seedance-2-5", audio: "elevenlabs-eleven-v4" } as const;
const WOMAN = /\b(woman|women|girl|female|lady|she|her)\b|بنت|امرأة|نساء|فتاة|سيدة/iu;

describe("the eleven playbooks", () => {
  it("are ten, each with a name, triggers, questions, a recipe and exemplars of its studio", () => {
    expect(PLAYBOOKS).toHaveLength(11);
    for (const p of PLAYBOOKS) {
      expect(p.name.length).toBeGreaterThan(3);
      expect(p.triggers.length).toBeGreaterThanOrEqual(8);
      expect(p.ask.length).toBeGreaterThanOrEqual(2);
      expect(p.recipe.length).toBeGreaterThanOrEqual(4);
      expect(p.exemplars.length).toBeGreaterThanOrEqual(3);
      for (const e of p.exemplars) {
        const def = generatorById(STUDIO_GENERATOR[e.studio])!;
        expect(e.prompt.length, e.ask).toBeLessThanOrEqual(def.prompt.max);
        if (e.studio !== "audio") expect(drawsRealWoman(e.prompt), e.ask).toBe(false);
      }
      expect(detectPlaybook(p.exemplars[0].ask), p.id).toBe(p.id);
    }
  });

  it("have options the registry really has", () => {
    for (const p of PLAYBOOKS) {
      for (const [studio, s] of Object.entries(p.settings) as [keyof typeof STUDIO_GENERATOR, Settings][]) {
        const def = generatorById(STUDIO_GENERATOR[studio])!;
        const ans = checkAnswer({ settings: Object.entries(s).map(([key, value]) => ({ key, value: String(value) })) }, { defs: [def], draft: { generatorId: def.id, prompt: "", instructions: "", settings: {}, refStyle: "none", refs: [] }, attachments: 0 });
        expect(ans.set.settings, `${p.id} ${studio}`).toEqual(s);
      }
    }
  });

  it("are told to the assistant: the brief names each, the guide carries the recipe", () => {
    for (const studio of ["image", "video", "audio"] as const) {
      const sys = assistantSystem(studio, GENERATORS.filter((g) => g.output === studio));
      for (const p of PLAYBOOKS) expect(sys).toContain(p.id);
      expect(sys).toContain(WOMEN_RULE);
      expect(playbooksBrief(studio)).toContain("«ثامبنيل");
    }
    for (const p of PLAYBOOKS) expect(playbookGuide(p.id, p.studio)).toContain(p.recipe[0]);
    expect(ASSISTANT_SCHEMA.required).toContain("thumbnailPerson");
    expect(JAWAD_KNOWLEDGE).toContain("«جواد»");
    expect(JAWAD_KNOWLEDGE).toContain("No real (photoreal) women");
  });
});

for (const p of PLAYBOOKS) {
  describe(`${p.id}: ${EXAMPLES_PER_PLAYBOOK} examples`, () => {
    const list = examplesFor(p.id);

    it("are a thousand distinct ones", () => {
      expect(list).toHaveLength(EXAMPLES_PER_PLAYBOOK);
      expect(new Set(list.map((e) => `${e.ask}|${e.prompt}`)).size).toBe(EXAMPLES_PER_PLAYBOOK);
      expect(new Set(list.map((e) => e.ask)).size).toBeGreaterThan(EXAMPLES_PER_PLAYBOOK / 4);
    });

    it.each(list.map((e) => [e.id, e] as const))("%s is recognised, fits the form, and draws no woman", (_id, e) => {
      // recognised from the request alone
      expect(detectPlaybook(e.ask)).toBe(p.id);
      // the form takes it as it is
      const def = generatorById(STUDIO_GENERATOR[e.studio])!;
      const ans = checkAnswer(
        { prompt: e.prompt, settings: Object.entries(e.settings).map(([key, value]) => ({ key, value: String(value) })) },
        { defs: [def], draft: { generatorId: def.id, prompt: "", instructions: "", settings: {}, refStyle: "none", refs: [] }, attachments: 0 },
      );
      expect(ans.blocked).toBeUndefined();
      expect(ans.set.prompt).toBe(e.prompt);
      expect(ans.set.settings).toEqual(e.settings);
      // and the engine prices it without an issue about those options
      const refs = e.prompt.includes("@source")
        ? [{ id: "v1", kind: "video" as const, role: "reference" as const, name: "source", mime: "video/mp4", bytes: 5_000_000, width: 1080, height: 1920, durationMs: Number(e.settings.duration) * 1000, fps: 30, status: "ready" as const }]
        : e.prompt.includes("@ref") ? [{ id: "r1", kind: "image" as const, role: (p.id === "viral-effect" ? "first_frame" : "reference") as "first_frame" | "reference", name: "ref", mime: "image/png", bytes: 500000, width: 1024, height: 1024, durationMs: null, fps: null, status: "ready" as const }] : [];
      const ev = evaluate(def, { settings: e.settings, prompt: e.prompt, instructions: "", refStyle: refs.length ? (p.id === "viral-effect" ? "frames" : "references") : "none", refs }, {});
      for (const k of Object.keys(e.settings)) {
        const o = ev.options.find((x) => x.key === k);
        if (o && !o.hidden && !o.fixed) expect(ev.settings[k], `${e.id} ${k}`).toEqual(e.settings[k]);
      }
      expect(ev.issues.filter((i) => i.field !== "price" && !/سعر/.test(i.message)).map((i) => i.message), e.id).toEqual([]);
      // the site's rule
      expect(drawsRealWoman(e.prompt), e.id).toBe(false);
      expect(WOMAN.test(e.ask), e.id).toBe(false);
      // one reference at most is named, and it is in the prompt when the playbook needs it
      expect(e.prompt.length).toBeLessThanOrEqual(def.prompt.max);
    });

    it("come back first for their own requests", () => {
      for (const e of list.slice(0, 40)) {
        const near = nearestExamples(e.ask, e.studio, 3);
        expect(near[0]?.playbook, e.ask).toBe(p.id);
        expect(near.map((x) => x.ask)).toContain(e.ask);
      }
    });
  });
}
