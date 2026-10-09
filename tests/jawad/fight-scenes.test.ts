import { describe, expect, it } from "vitest";
import { generatorById } from "@config/jawad/generators";
import { checkAnswer } from "@config/jawad/assistant";
import { detectPlaybook } from "@config/jawad/playbooks";
import { FIGHT_CASES, FIGHT_METHOD, FIGHT_PLAYBOOK_ID, FIGHT_SCHOOLS, detectSchool, fightCases, nearestFightCases } from "@config/jawad/fight-scenes";
import { evaluate } from "@/lib/jawad/engine";
import { findMentions } from "@/lib/jawad/mentions";

// Ten thousand tests over the thousand worked fights «جواد» learns screen fighting from: ten checks on every fight.
const def = generatorById("byteplus-seedance-2-5")!;
const GORE = /\b(blood|bleeding|gore|gory|wound|stab(bed)?|decapitat\w*|corpse|dies|dead body|kill(s|ed)?)\b/i;
const cases = fightCases();

describe("the bank", () => {
  it("holds a thousand distinct fights over every school, with the method", () => {
    expect(cases).toHaveLength(FIGHT_CASES);
    expect(new Set(cases.map((c) => `${c.ask}|${c.prompt}`)).size).toBe(FIGHT_CASES);
    for (const s of FIGHT_SCHOOLS) expect(cases.filter((c) => c.school === s.id).length).toBeGreaterThanOrEqual(Math.floor(FIGHT_CASES / FIGHT_SCHOOLS.length));
    expect(FIGHT_METHOD).toContain("A FIGHT IS SHOTS, NOT PROSE");
  });
});

for (const c of cases) {
  describe(c.id, () => {
    it("opens with the specs: seconds, ratio, school, photoreal, non-IP, no gore", () => {
      expect(c.prompt.startsWith(`Cinematic fight scene, ${c.settings.duration} seconds, ${c.settings.ratio}, `)).toBe(true);
      expect(c.prompt).toContain("NON-IP");
      expect(c.prompt).toContain("No blood, no gore, no wounds.");
    });
    it("keeps the geography: who is screen-left and screen-right, the action centred", () => {
      expect(c.prompt).toContain("(screen-left)");
      expect(c.prompt).toContain("(screen-right)");
      expect(c.prompt).toContain("the action in the centre of the frame");
    });
    it("is written as shots with seconds that start at 0, follow on and end on the clip's length", () => {
      expect(c.shots.length).toBeGreaterThanOrEqual(1);
      expect(c.shots[0].from).toBe(0);
      for (let i = 1; i < c.shots.length; i++) expect(c.shots[i].from).toBe(c.shots[i - 1].to);
      expect(c.shots.at(-1)!.to).toBe(c.settings.duration);
      for (const s of c.shots) expect(s.to).toBeGreaterThan(s.from);
      expect(c.prompt).toContain("SHOT 1 (0–");
    });
    it("cuts several shots unless it is a one-take school, and every cut is marked", () => {
      if (c.shots.length === 1) expect(c.shots[0].size).toBe("one continuous take");
      else {
        expect(c.shots.length).toBeGreaterThanOrEqual(3);
        expect((c.prompt.match(/CUT TO SHOT/g) ?? []).length).toBe(c.shots.length - 1);
        for (const s of c.shots) expect(s.to - s.from).toBeLessThanOrEqual(c.settings.duration * 0.6 + 1e-9);
      }
    });
    it("carries its school's choreography grammar and physics", () => {
      const school = FIGHT_SCHOOLS.find((s) => s.id === c.school)!;
      expect(c.prompt).toContain(school.grammar);
      expect(c.prompt).toContain("Physics: weight shifting from the back foot");
    });
    it("has a sound line with no spoken words", () => {
      expect(c.prompt).toMatch(/Sound: .*no words/);
    });
    it("fits the form as it is and the engine prices it with no issue", () => {
      const ans = checkAnswer(
        { prompt: c.prompt, settings: Object.entries(c.settings).map(([key, value]) => ({ key, value: String(value) })) },
        { defs: [def], draft: { generatorId: def.id, prompt: "", instructions: "", settings: {}, refStyle: "none", refs: [] }, attachments: 0 },
      );
      expect(ans.set.prompt).toBe(c.prompt);
      expect(ans.set.settings).toEqual(c.settings);
      const ev = evaluate(def, { settings: c.settings, prompt: c.prompt, instructions: "", refStyle: "none", refs: [] }, {});
      expect(ev.issues.filter((i) => i.field !== "price" && !/سعر/.test(i.message)).map((i) => i.message)).toEqual([]);
      expect(findMentions(c.prompt)).toEqual([]);
    });
    it("shows no blood or death", () => {
      const noRules = c.prompt.replace("No blood, no gore, no wounds.", "").replace(/\(no cuts shown\)/g, "");
      expect(GORE.test(noRules)).toBe(false);
    });
    it("is recognised as a fight from its request alone, with its school", () => {
      expect(detectPlaybook(c.ask)).toBe(FIGHT_PLAYBOOK_ID);
      const s = detectSchool(c.ask);
      expect(s === null || s === c.school).toBe(true);
    });
    it("comes back first among the worked fights for its own words", () => {
      expect(nearestFightCases(c.ask, 3).map((x) => x.ask)).toContain(c.ask);
    });
  });
}
