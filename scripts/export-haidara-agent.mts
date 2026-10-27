// Writes «حيدرا ماكس» as a Claude Managed Agent: config/editor/agent/haidara.powers.json (every power of the Motion Lab as
// JSON), haidara.agent.json (the body of POST /v1/agents) and skills/haidara-lab (the skill folder uploaded with the agent).
// All of it is built from the lab's own sources (src/lib/editor/scene/agent-spec.ts), so it cannot drift: run this after
// changing the lab, and tests/editor/haidara-agent.test.ts fails when the files are out of step.
// Run:  npx vite-node -c vitest.config.mts scripts/export-haidara-agent.mts
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LAB_SKILL_NAME, buildHaidaraAgent, buildHaidaraPowers, buildLabSkillFiles } from "../src/lib/editor/scene/agent-spec";

const OUT = "config/editor/agent";
const put = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
};

put(join(OUT, "haidara.powers.json"), `${JSON.stringify(buildHaidaraPowers(), null, 2)}\n`);
put(join(OUT, "haidara.agent.json"), `${JSON.stringify(buildHaidaraAgent(), null, 2)}\n`);
rmSync(join(OUT, "skills", LAB_SKILL_NAME), { recursive: true, force: true });
for (const f of buildLabSkillFiles()) put(join(OUT, "skills", LAB_SKILL_NAME, f.path), f.content);
console.log(`written to ${OUT}/`);
