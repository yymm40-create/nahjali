// DEV ONLY: checks «لأجل المهدي» isolation against the real Supabase project, then cleans up.
// Signs in as the owner (real session, RLS applies) and tries to reach another user's data.
// Usage: npx tsx --env-file=.env.local scripts/test-mahdi-security.mts
import { createClient } from "@supabase/supabase-js";

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

const today = new Date().toISOString().slice(0, 10);
// The other user's data, made with the service role
const otherHadProfile = Boolean((await admin.from("mahdi_profiles").select("user_id").eq("user_id", other.id).maybeSingle()).data);
if (!otherHadProfile) await admin.from("mahdi_profiles").insert({ user_id: other.id, display_name: "TEST" });
const theirProject = (await admin.from("mahdi_projects").insert({ user_id: other.id, name: "TEST other project" }).select().single()).data!;
const theirHabit = (await admin.from("mahdi_habits").insert({ user_id: other.id, project_id: theirProject.id, name: "TEST habit" }).select().single()).data!;
await admin.from("mahdi_habit_versions").insert({ habit_id: theirHabit.id, user_id: other.id, effective_from: today, measure: "check", target: 1, freq: "daily" });
await admin.from("mahdi_logs").insert({ habit_id: theirHabit.id, user_id: other.id, log_date: today, value: 1 });

let myProjectId: string | null = null;
try {
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: OWNER });
  const me = createClient(URL_, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { error: otpErr } = await me.auth.verifyOtp({ token_hash: link.data.properties!.hashed_token, type: "magiclink" });
  if (otpErr) throw otpErr;

  check(((await me.from("mahdi_projects").select("id").eq("id", theirProject.id)).data ?? []).length === 0, "owner cannot see another user's project");
  check(((await me.from("mahdi_habits").select("id").eq("id", theirHabit.id)).data ?? []).length === 0, "owner cannot see another user's habit");
  check(((await me.from("mahdi_logs").select("habit_id").eq("habit_id", theirHabit.id)).data ?? []).length === 0, "owner cannot see another user's logs");
  check(((await me.from("mahdi_profiles").select("user_id").eq("user_id", other.id)).data ?? []).length === 0, "owner cannot see another user's profile");
  check(((await me.from("mahdi_projects").update({ name: "hacked" }).eq("id", theirProject.id).select()).data ?? []).length === 0, "owner cannot rename another user's project");
  check(((await me.from("mahdi_habits").delete().eq("id", theirHabit.id).select()).data ?? []).length === 0, "owner cannot delete another user's habit");
  const setLog = await me.rpc("mahdi_set_log", { p_habit: theirHabit.id, p_date: today, p_value: 5, p_client_ts: new Date().toISOString() });
  check(Boolean(setLog.error), "owner cannot log on another user's habit");
  const attach = await me.rpc("mahdi_create_habit", {
    p_project: theirProject.id, p_name: "x", p_icon: "", p_category: "", p_notes: "", p_reminder: null,
    p_start: today, p_measure: "check", p_target: 1, p_unit: "", p_freq: "daily", p_days: [],
  });
  check(Boolean(attach.error), "owner cannot add a habit to another user's project");
  await me.rpc("mahdi_archive_project", { p_project: theirProject.id, p_date: today, p_archive: true });
  const still = (await admin.from("mahdi_projects").select("archived_at, name").eq("id", theirProject.id).single()).data!;
  check(still.archived_at === null && still.name === "TEST other project", "their project is untouched");
  const theirLog = (await admin.from("mahdi_logs").select("value").eq("habit_id", theirHabit.id).single()).data!;
  check(Number(theirLog.value) === 1, "their log is untouched");

  // The owner's own data works through the same rules
  const mine = await me.from("mahdi_projects").insert({ name: "TEST my project" }).select().single();
  myProjectId = mine.data?.id ?? null;
  check(Boolean(myProjectId), "owner can create their own project");
  const future = await me.from("mahdi_habit_versions").insert({ habit_id: theirHabit.id, effective_from: today, measure: "check", target: 1, freq: "daily" });
  check(Boolean(future.error), "owner cannot add a goal version to another user's habit");
} finally {
  if (myProjectId) await admin.from("mahdi_projects").delete().eq("id", myProjectId);
  await admin.from("mahdi_projects").delete().eq("id", theirProject.id);
  if (!otherHadProfile) await admin.from("mahdi_profiles").delete().eq("user_id", other.id);
  console.log("🧹 test data removed");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
