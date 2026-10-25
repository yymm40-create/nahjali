import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LAB_SKILL_NAME, LAB_TOOLS, MODES, OWNER_SKILL_DIRS, buildHaidaraAgent, buildHaidaraPowers, buildLabSkillFiles } from "@/lib/editor/scene/agent-spec";
import { PASS, RUBRIC } from "@/lib/editor/scene/skill";
import { LAB_GROUPS } from "@config/editor/lab-options";

// «حيدرا ماكس» as a Claude Managed Agent: his powers are written as JSON from the lab's own sources, and the committed files must
// be exactly what the sources give (run `npx vite-node -c vitest.config.mts scripts/export-haidara-agent.mts` after changing the lab).

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const DIR = "config/editor/agent";

describe("the files are in step with the lab", () => {
  it("haidara.powers.json", () => expect(read(`${DIR}/haidara.powers.json`)).toBe(`${JSON.stringify(buildHaidaraPowers(), null, 2)}\n`));
  it("haidara.agent.json", () => expect(read(`${DIR}/haidara.agent.json`)).toBe(`${JSON.stringify(buildHaidaraAgent(), null, 2)}\n`));
  it("the skill folder haidara-lab", () => {
    for (const f of buildLabSkillFiles()) expect(read(`${DIR}/skills/${LAB_SKILL_NAME}/${f.path}`), f.path).toBe(f.content);
  });
});

describe("the agent is a valid body for POST /v1/agents", () => {
  const a = buildHaidaraAgent();
  it("has the required fields within the API's limits", () => {
    expect(a.name.length).toBeGreaterThan(0);
    expect(a.name.length).toBeLessThanOrEqual(256);
    expect(a.description.length).toBeLessThanOrEqual(2048);
    expect(a.system.length).toBeLessThanOrEqual(100_000);
    expect(a.tools.length).toBeLessThanOrEqual(256);
    expect(Object.keys(a.metadata).length).toBeLessThanOrEqual(16);
    expect(a.model.id).toBe("claude-opus-5-5");
  });

  it("carries the lab's three custom tools, named legally and with a schema", () => {
    expect(LAB_TOOLS.map((t) => t.name)).toEqual(["lab_render", "lab_picture", "lab_deliver"]);
    for (const t of LAB_TOOLS) {
      expect(t.name).not.toMatch(/^(mcp__|ant__)/);
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema.required.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(80);
    }
    expect(a.tools[0]).toMatchObject({ type: "agent_toolset_20260401" });
  });

  it("starts with no skills (the create script attaches the uploaded ones)", () => expect(a.skills).toEqual([]));
});

describe("the powers cover everything the lab does", () => {
  const p = buildHaidaraPowers();
  it("every mode of the lab", () => {
    expect(MODES.map((m) => m.id)).toEqual(["chat", "plan", "write", "fix", "review", "cover", "render", "search", "pictures", "footage", "voice"]);
    expect(p.modes).toHaveLength(MODES.length);
  });

  it("the whole score sheet, the pass mark and every gallery option", () => {
    expect(p.quality_bar.rubric.map((r) => r.id)).toEqual(RUBRIC.map((r) => r.id));
    expect(p.quality_bar.pass_mark).toBe(PASS);
    expect(p.gallery.map((g) => g.id)).toEqual(LAB_GROUPS.map((g) => g.id));
    expect(p.gallery.flatMap((g) => g.options)).toHaveLength(LAB_GROUPS.flatMap((g) => g.options).length);
  });

  it("the shapes of his answers, the contract, the kit, the sound and the formats", () => {
    expect(Object.keys(p.output_shapes)).toEqual(["plan", "code", "review", "chat", "cover", "cover_review"]);
    expect(p.scene_program.contract).toContain("scene({");
    expect(p.scene_program.kit_api).toContain("K (the kit");
    expect(p.scene_program.sound_kit_api.length).toBeGreaterThan(500);
    expect(p.scene_program.forbidden.length).toBeGreaterThanOrEqual(7);
    expect(p.scene_program.cue_sfx_ids.length).toBeGreaterThan(5);
    expect(p.viral_formats).toContain("DUST TO WORD");
    expect(p.exemplars.length).toBeGreaterThanOrEqual(3);
  });

  it("the owner's skills are all uploaded with the agent", () => {
    expect(p.agent.skills_to_upload).toEqual([LAB_SKILL_NAME, ...OWNER_SKILL_DIRS]);
    expect(p.owner_skills.catalogue.length).toBeGreaterThan(100);
    for (const d of OWNER_SKILL_DIRS) expect(read(`config/editor/skills/${d}/SKILL.md`)).toMatch(new RegExp(`^---\\nname: ${d}\\n`));
  });

  it("the lab skill's SKILL.md is a valid skill header", () => {
    const head = buildLabSkillFiles().find((f) => f.path === "SKILL.md")!.content;
    expect(head).toMatch(new RegExp(`^---\\nname: ${LAB_SKILL_NAME}\\ndescription: .{20,1000}\\n---`));
    expect(LAB_SKILL_NAME).toMatch(/^[a-z0-9-]{1,64}$/);
  });
});
