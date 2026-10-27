// Creates «حيدرا ماكس» in YOUR Claude account as a Managed Agent: uploads the five skills (haidara-lab + the owner's four),
// creates the agent from config/editor/agent/haidara.agent.json with those skills attached, and prints the ids to put in
// the environment (CLAUDE_AGENT_ID, and CLAUDE_ENVIRONMENT_ID for the container). Run it ONCE; to change the agent later run
// it with  --update <agent_id>  (a new version of the same agent) — never create a second one.
//   ANTHROPIC_API_KEY=sk-ant-… npx vite-node -c vitest.config.mts scripts/create-haidara-agent.mts [--update agent_…] [--dry]
// --dry prints what would be sent and uploads nothing. The environment (the container) is created too when asked:  --with-environment
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LAB_SKILL_NAME, OWNER_SKILL_DIRS } from "../src/lib/editor/scene/agent-spec";

const KEY = process.env.ANTHROPIC_API_KEY;
const BASE = process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const updateId = args.includes("--update") ? args[args.indexOf("--update") + 1] : "";
if (!KEY && !dry) throw new Error("ANTHROPIC_API_KEY is not set");

const AGENT_DIR = "config/editor/agent";
const folders: Record<string, string> = { [LAB_SKILL_NAME]: join(AGENT_DIR, "skills", LAB_SKILL_NAME) };
for (const d of OWNER_SKILL_DIRS) folders[d] = join("config/editor/skills", d);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const headers = (beta?: string) => ({ "x-api-key": KEY!, "anthropic-version": "2023-06-01", ...(beta ? { "anthropic-beta": beta } : {}) });
async function api<T>(path: string, init: RequestInit, beta?: string): Promise<T> {
  const res = await fetch(`${BASE}/v1${path}`, { ...init, headers: { ...headers(beta), ...(init.headers as Record<string, string> | undefined) } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${body.error?.message ?? JSON.stringify(body)}`);
  return body;
}

/** One skill = one multipart upload, every file's path starting with the skill's folder name (the Skills API's rule). */
async function uploadSkill(name: string, dir: string): Promise<string> {
  const files = walk(dir);
  const bytes = files.reduce((n, f) => n + statSync(f).size, 0);
  console.log(`skill ${name}: ${files.length} files, ${(bytes / 1e6).toFixed(1)} MB${bytes > 30e6 ? "  ← over the 30 MB limit!" : ""}`);
  if (dry) return `(dry) ${name}`;
  const form = new FormData();
  for (const f of files) form.append("files[]", new Blob([readFileSync(f)]), `${name}/${relative(dir, f)}`);
  const skill = await api<{ id: string }>("/skills", { method: "POST", body: form });
  console.log(`  → ${skill.id}`);
  return skill.id;
}

const agent = JSON.parse(readFileSync(join(AGENT_DIR, "haidara.agent.json"), "utf8"));
const skills: { type: "custom"; skill_id: string; version: string }[] = [];
for (const [name, dir] of Object.entries(folders)) skills.push({ type: "custom", skill_id: await uploadSkill(name, dir), version: "latest" });
agent.skills = skills;

if (dry) {
  console.log(`agent: ${agent.name}, system ${agent.system.length} chars, tools ${agent.tools.length}, skills ${agent.skills.length}`);
  process.exit(0);
}

const BETA = "managed-agents-2026-04-01";
let result: { id: string; version: number };
if (updateId) {
  const cur = await api<{ version: number }>(`/agents/${updateId}`, { method: "GET" }, BETA);
  result = await api(`/agents/${updateId}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...agent, version: cur.version }) }, BETA);
} else {
  result = await api("/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(agent) }, BETA);
}
console.log(`\nagent ${result.id} (version ${result.version})`);
console.log(`\nput in the environment:\n  CLAUDE_AGENT_ID=${result.id}`);

if (args.includes("--with-environment")) {
  const env = await api<{ id: string }>("/environments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "حيدرا ماكس", config: { type: "cloud", networking: { type: "unrestricted" } } }) }, BETA);
  console.log(`  CLAUDE_ENVIRONMENT_ID=${env.id}`);
} else {
  console.log("  CLAUDE_ENVIRONMENT_ID=<an existing environment's id, or re-run with --with-environment>");
}
