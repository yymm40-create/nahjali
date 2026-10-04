// DEV ONLY: checks the film branch foundation against the real Supabase project, then cleans up.
//   1. Isolation: the owner's session cannot read another user's project, files or usage.
//   2. Usage ledger: same key → one job; failure → released (not counted); success → settled.
// Usage: npx tsx --env-file=.env.local scripts/test-film-foundation.mts
import { createClient } from "@supabase/supabase-js";
import { failJob, projectCost, startJob, succeedJob } from "../src/lib/film/usage";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const OWNER = "yymm40@gmail.com";

let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "✅" : "❌"} ${label}`);
  if (!ok) failures++;
};

const { data: users } = await admin.auth.admin.listUsers({ perPage: 200 });
const owner = users.users.find((u) => u.email === OWNER)!;
const other = users.users.find((u) => u.email !== OWNER)!;
if (!owner || !other) throw new Error("need the owner and one other user");

// Test data: one project each
const mk = async (userId: string, title: string) =>
  (await admin.from("film_projects").insert({ user_id: userId, title }).select().single()).data!;
const mine = await mk(owner.id, "TEST owner project");
const theirs = await mk(other.id, "TEST other user project");
const theirFile = `${other.id}/${theirs.id}/uploads/test.png`;
await admin.storage.from("film").upload(theirFile, Buffer.from("89504e470d0a1a0a", "hex"), { contentType: "image/png" });

try {
  // ── 1. Isolation through the owner's real session (RLS) ──
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER });
  const asOwner = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error: otpErr } = await asOwner.auth.verifyOtp({ token_hash: link.data.properties!.hashed_token, type: "magiclink" });
  if (otpErr) throw otpErr;

  const { data: visible } = await asOwner.from("film_projects").select("id");
  const ids = (visible ?? []).map((p) => p.id);
  check(ids.includes(mine.id), "owner sees own project");
  check(!ids.includes(theirs.id), "owner does NOT see the other user's project");
  const direct = await asOwner.from("film_projects").select("id").eq("id", theirs.id);
  check((direct.data ?? []).length === 0, "direct lookup of the other project returns nothing");
  const file = await asOwner.storage.from("film").download(theirFile);
  check(Boolean(file.error), "owner cannot download the other user's file");
  const signed = await asOwner.storage.from("film").createSignedUrl(theirFile, 60);
  check(Boolean(signed.error), "owner cannot create a link to the other user's file");
  const write = await asOwner.from("film_projects").update({ title: "hacked" }).eq("id", theirs.id).select();
  check((write.data ?? []).length === 0, "owner cannot edit the other user's project from the browser");
  const settings = await asOwner.from("film_settings").select("*");
  check((settings.data ?? []).length === 0, "browser cannot read the caps table");

  // ── 2. Usage ledger ──
  const u = { id: other.id, email: other.email };
  const key = `test:${Date.now()}`;
  const a = await startJob({ projectId: theirs.id, user: u, service: "seedance", operation: "test", idempotencyKey: key, estimateUsd: 0.5, units: 5, unit: "seconds" });
  const b = await startJob({ projectId: theirs.id, user: u, service: "seedance", operation: "test", idempotencyKey: key, estimateUsd: 0.5, units: 5, unit: "seconds" });
  check(a.created && !b.created && a.job.id === b.job.id, "same key twice → one job (no double send)");
  const rows1 = (await admin.from("film_usage").select("*").eq("job_id", a.job.id)).data ?? [];
  check(rows1.length === 1 && rows1[0].state === "reserved", "one reservation recorded");
  check(Math.abs((await projectCost(theirs.id)).total - 0.5) < 1e-6, "reserved cost counts while running");

  await failJob(a.job.id, new Error("provider timeout"));
  const r2 = (await admin.from("film_usage").select("state").eq("job_id", a.job.id).single()).data!;
  check(r2.state === "released", "failure → released");
  check((await projectCost(theirs.id)).total === 0, "failed job costs nothing");

  const c = await startJob({ projectId: theirs.id, user: u, service: "seedance", operation: "test", idempotencyKey: `${key}:retry`, estimateUsd: 0.5, units: 5, unit: "seconds" });
  await succeedJob(c.job.id, { costUsd: 0.515, units: 5 });
  const r3 = (await admin.from("film_usage").select("state,actual_cost_usd").eq("job_id", c.job.id).single()).data!;
  check(r3.state === "settled" && Number(r3.actual_cost_usd) === 0.515, "retry success → settled with the real cost");
  check(Math.abs((await projectCost(theirs.id)).total - 0.515) < 1e-6, "project cost = only the successful job");

} finally {
  await admin.storage.from("film").remove([theirFile]);
  await admin.from("film_usage").delete().eq("operation", "test");
  await admin.from("film_projects").delete().in("id", [mine.id, theirs.id]);
  console.log("🧹 test data removed");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
