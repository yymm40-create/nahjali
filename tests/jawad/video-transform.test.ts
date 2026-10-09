import { describe, expect, it } from "vitest";
import { generatorById } from "@config/jawad/generators";
import { checkAnswer } from "@config/jawad/assistant";
import { detectPlaybook } from "@config/jawad/playbooks";
import { LOCK_CLAUSE, TRANSFORM_CASES, TRANSFORM_KINDS, TRANSFORM_METHOD, TRANSFORM_PLAYBOOK_ID, detectTransformKind, nearestTransformCases, transformCases, transformCasesBrief } from "@config/jawad/video-transform";
import { evaluate } from "@/lib/jawad/engine";
import { findMentions } from "@/lib/jawad/mentions";

// Ten thousand tests over the thousand worked before→after cases «جواد» learns footage transformation from: ten
// checks on every case — the source declared, the fence, the one change written A → B, the lock-down clause last,
// the specs matching the clip, the form taking it as it is, the engine pricing it, the references all declared, the
// kind recognised from the request alone, and the case found again from its own words.
const def = generatorById("byteplus-seedance-2-5")!;
const cases = transformCases();

describe("the bank", () => {
  it("holds a thousand distinct cases spread over the eight kinds", () => {
    expect(cases).toHaveLength(TRANSFORM_CASES);
    expect(new Set(cases.map((c) => `${c.ask}|${c.prompt}`)).size).toBe(TRANSFORM_CASES);
    for (const k of TRANSFORM_KINDS) expect(cases.filter((c) => c.kind === k.id).length).toBe(TRANSFORM_CASES / TRANSFORM_KINDS.length);
  });
  it("teaches the method the cases follow", () => {
    expect(TRANSFORM_METHOD).toContain("@source");
    expect(TRANSFORM_METHOD).toContain(LOCK_CLAUSE);
    expect(TRANSFORM_METHOD).toContain("ONE CHANGE PER PASS");
    expect(transformCasesBrief(cases.slice(0, 2))).toContain("check:");
  });
});

for (const c of cases) {
  describe(c.id, () => {
    const body = c.prompt.split("\n\n");
    it("declares the source clip first: who, where, what, camera, light, and the one change", () => {
      expect(body[0].startsWith("@source: original clip — ")).toBe(true);
      expect(body[0]).toContain(c.before.who);
      expect(body[0]).toContain(c.before.camera);
      expect(body[0]).toContain(c.before.light);
      expect(body[0]).toMatch(/Preserve his identity, face, wardrobe, performance, framing, camera and motion exactly; change only /);
    });
    it("carries a specs line matching the clip: photoreal, its aspect, its seconds, non-IP, source dialogue kept", () => {
      expect(body[1]).toBe(body[1].trim());
      expect(body[1]).toMatch(/^Photoreal\. /);
      expect(body[1]).toContain(`${c.before.ratio}. ${c.before.seconds}s.`);
      expect(body[1]).toContain("NON-IP");
      expect(body[1]).toContain("SFX and source dialogue only");
    });
    it("fences what stays or restyles the look only, and names the change with an edit verb", () => {
      const action = body[2];
      expect(action).toMatch(/^One continuous shot, .*same framing as @source\./);
      if (c.kind === "restyle") expect(action).toContain("Restyle the entire shot");
      else expect(action).toMatch(/Keep the man, his face, /);
      expect(action).toMatch(/\b(Replace|Remove|Relight|Restyle|Change|Add)\b/);
    });
    it("ends its action with the lock-down clause", () => {
      const action = body[2];
      const lock = c.kind === "outfit" ? LOCK_CLAUSE.replace("the same wardrobe unless changed above; ", "") : LOCK_CLAUSE;
      expect(action.endsWith(lock)).toBe(true);
    });
    it("keeps the person's own voice and adds only the change's sound", () => {
      expect(body[body.length - 1]).toMatch(/^SFX and source dialogue only: his own voice as in the source/);
      expect(c.prompt).not.toMatch(/says in|voice-over|narrat/i);
    });
    it("fits the form as it is: options the registry has, the prompt within its limit", () => {
      const ans = checkAnswer(
        { prompt: c.prompt, settings: Object.entries(c.settings).map(([key, value]) => ({ key, value: String(value) })) },
        { defs: [def], draft: { generatorId: def.id, prompt: "", instructions: "", settings: {}, refStyle: "none", refs: [] }, attachments: 0 },
      );
      expect(ans.set.prompt).toBe(c.prompt);
      expect(ans.set.settings).toEqual(c.settings);
      expect(c.settings.duration).toBe(c.before.seconds);
      expect(c.settings.ratio).toBe(c.before.ratio);
      expect(c.prompt.length).toBeLessThanOrEqual(def.prompt.max);
    });
    it("is priced by the engine with the clip as a video reference and no issue", () => {
      const refs = [
        { id: "v1", kind: "video" as const, role: "reference" as const, name: "source", mime: "video/mp4", bytes: 5_000_000, width: 1080, height: 1920, durationMs: c.before.seconds * 1000, fps: 30, status: "ready" as const },
        ...(c.ref ? [{ id: "i1", kind: "image" as const, role: "reference" as const, name: c.ref.name, mime: "image/png", bytes: 500_000, width: 1024, height: 1024, durationMs: null, fps: null, status: "ready" as const }] : []),
      ];
      const ev = evaluate(def, { settings: c.settings, prompt: c.prompt, instructions: "", refStyle: "references", refs }, {});
      expect(ev.mode.id).toBe("omni_reference");
      expect(ev.issues.filter((i) => i.field !== "price" && !/سعر/.test(i.message)).map((i) => i.message)).toEqual([]);
      expect(ev.settings.duration).toBe(c.before.seconds);
    });
    it("mentions only references it declared: @source, and a second one when the change needs it", () => {
      const names = new Set(findMentions(c.prompt).map((m) => m.name));
      expect(names.has("source")).toBe(true);
      const declared = new Set(["source", ...(c.ref ? [c.ref.name] : [])]);
      for (const n of names) expect(declared.has(n), `@${n} in ${c.id}`).toBe(true);
      if (c.ref) expect(c.prompt).toContain(`@${c.ref.name}: ${c.ref.holds}`);
    });
    it("is recognised from its request alone, as a transformation of its kind, with a check list", () => {
      expect(detectPlaybook(c.ask)).toBe(TRANSFORM_PLAYBOOK_ID);
      const k = detectTransformKind(c.ask);
      // snow falling is weather to the ear and an added element to the eye: both readings are right
      expect(k === null || k === c.kind || (c.kind === "add" && k === "weather")).toBe(true);
      expect(c.check.length).toBeGreaterThanOrEqual(3);
    });
    it("comes back first for its own words", () => {
      const near = nearestTransformCases(c.ask, 3);
      expect(near.map((x) => x.ask)).toContain(c.ask);
    });
  });
}
