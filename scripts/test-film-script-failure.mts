// DEV ONLY: a screenwriter reply that fails (here: a wrong API key) must leave no new version,
// mark the job failed and release its reserved cost. Cleans up after itself.
// Usage: npx tsx --env-file=.env.local scripts/test-film-script-failure.mts
import { createClient } from "@supabase/supabase-js";
import { startJob } from "../src/lib/film/usage";
import { runScriptJob } from "../src/lib/film/script";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
const owner = users.users.find((u) => u.email === "yymm40@gmail.com")!;

const project = (await admin.from("film_projects").insert({ user_id: owner.id, title: "TEST failure", story: "قصة اختبار قصيرة جدًا للتجربة." }).select().single()).data!;
let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
};

try {
  const msg = (await admin.from("film_messages").insert({ project_id: project.id, stage: "screenwriter", role: "user", content: "قصة اختبار" }).select("id").single()).data!;
  const { job } = await startJob({ projectId: project.id, user: owner, service: "anthropic", operation: "screenwriter", idempotencyKey: msg.id, estimateUsd: 0.6, units: 0, unit: "tokens" });

  process.env.ANTHROPIC_API_KEY = "sk-ant-invalid-for-test";
  await runScriptJob(project.id, job.id);

  const j = (await admin.from("film_jobs").select("status,error").eq("id", job.id).single()).data!;
  check(j.status === "failed", `job marked failed (${String(j.error).slice(0, 60)})`);
  const u = (await admin.from("film_usage").select("state").eq("job_id", job.id).single()).data!;
  check(u.state === "released", "reserved cost released (not charged)");
  const { count } = await admin.from("film_versions").select("id", { count: "exact", head: true }).eq("project_id", project.id);
  check(count === 0, "no deliverable created from a failed reply");
} finally {
  await admin.from("film_usage").delete().eq("project_id", project.id);
  await admin.from("film_projects").delete().eq("id", project.id);
  console.log("🧹 test data removed");
}
console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
