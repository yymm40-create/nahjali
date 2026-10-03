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

// Phase 5 data of the other user (community, challenges, notifications), made with the service role
const ids: { challenge?: string; draft?: string; section?: string; post?: string; hiddenPost?: string; sub?: string } = {};
const otherHadPrivacy = Boolean((await admin.from("mahdi_privacy").select("user_id").eq("user_id", other.id).maybeSingle()).data);
const otherHadNotif = Boolean((await admin.from("mahdi_notification_settings").select("user_id").eq("user_id", other.id).maybeSingle()).data);
const otherHadPublic = Boolean((await admin.from("mahdi_public_profiles").select("user_id").eq("user_id", other.id).maybeSingle()).data);
if (!otherHadPrivacy) await admin.from("mahdi_privacy").insert({ user_id: other.id, community: true, leaderboard: true });
if (!otherHadNotif) await admin.from("mahdi_notification_settings").insert({ user_id: other.id, mode: "daily" });
if (!otherHadPublic) await admin.from("mahdi_public_profiles").insert({ user_id: other.id, display_name: "TEST" });
ids.section = (await admin.from("mahdi_challenge_sections").insert({ name: "TEST section" }).select("id").single()).data!.id;
const def = { section_id: ids.section, title: "TEST", measure: "check", target: 1, freq: "daily", starts_on: today };
ids.challenge = (await admin.from("mahdi_challenges").insert({ ...def, status: "published" }).select("id").single()).data!.id;
ids.draft = (await admin.from("mahdi_challenges").insert({ ...def, title: "TEST draft", status: "draft" }).select("id").single()).data!.id;
await admin.from("mahdi_challenge_members").insert({ challenge_id: ids.challenge, user_id: other.id, joined_on: today, on_leaderboard: true });
await admin.from("mahdi_challenge_logs").insert({ challenge_id: ids.challenge, user_id: other.id, log_date: today, value: 1 });
ids.sub = (await admin.from("mahdi_push_subscriptions").insert({ user_id: other.id, endpoint: "https://test.invalid/other", p256dh: "p", auth: "a" }).select("id").single()).data!.id;
ids.post = (await admin.from("mahdi_posts").insert({ user_id: other.id, kind: "week", payload: { title: "t", value: "1%" } }).select("id").single()).data!.id;
ids.hiddenPost = (await admin.from("mahdi_posts").insert({ user_id: other.id, kind: "week", payload: { title: "t", value: "2%" }, hidden_at: new Date().toISOString() }).select("id").single()).data!.id;

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

  // ── phase 5: privacy, community, challenges, notifications ──
  const none = async (q: PromiseLike<{ data: unknown[] | null }>) => ((await q).data ?? []).length === 0;
  check(await none(me.from("mahdi_privacy").select("user_id").eq("user_id", other.id)), "owner cannot read another user's privacy settings");
  check(await none(me.from("mahdi_notification_settings").select("user_id").eq("user_id", other.id)), "owner cannot read another user's notification settings");
  check(await none(me.from("mahdi_push_subscriptions").select("id").eq("id", ids.sub!)), "owner cannot read another user's push subscriptions");
  check(await none(me.from("mahdi_challenge_members").select("user_id").eq("challenge_id", ids.challenge!)), "owner cannot see who else joined a challenge");
  check(await none(me.from("mahdi_challenge_logs").select("user_id").eq("challenge_id", ids.challenge!)), "owner cannot read another user's challenge logs");
  check(await none(me.from("mahdi_privacy").update({ community: false }).eq("user_id", other.id).select()), "owner cannot change another user's privacy settings");
  check(await none(me.from("mahdi_push_subscriptions").delete().eq("id", ids.sub!).select()), "owner cannot delete another user's push subscription");
  check(await none(me.from("mahdi_challenge_members").update({ left_on: today }).eq("user_id", other.id).select()), "owner cannot remove another user from a challenge");
  check(Boolean((await me.from("mahdi_challenge_members").insert({ challenge_id: ids.challenge!, user_id: other.id, joined_on: today })).error), "owner cannot join a challenge in another user's name");
  check(Boolean((await me.from("mahdi_push_subscriptions").insert({ user_id: other.id, endpoint: "https://test.invalid/x", p256dh: "p", auth: "a" })).error), "owner cannot register a device for another user");
  check(Boolean((await me.from("mahdi_post_reactions").insert({ post_id: ids.post!, user_id: other.id, kind: "dua" })).error), "owner cannot react in another user's name");
  check(Boolean((await me.rpc("mahdi_set_challenge_log", { p_challenge: ids.challenge!, p_date: today, p_value: 1, p_client_ts: new Date().toISOString() })).error), "owner cannot log in a challenge they have not joined");
  check(((await me.from("mahdi_challenges").select("id").eq("id", ids.challenge!)).data ?? []).length === 1, "a published challenge is visible to signed-in users");
  check(await none(me.from("mahdi_challenges").select("id").eq("id", ids.draft!)), "a draft challenge is not visible");
  check(Boolean((await me.from("mahdi_challenges").insert({ ...def, title: "hack" })).error), "users cannot create challenges");
  check(Boolean((await me.from("mahdi_posts").insert({ user_id: owner.id, kind: "week", payload: { title: "fake", value: "100%" } })).error), "users cannot write posts directly (the server computes them)");
  check(Boolean((await me.from("mahdi_public_profiles").insert({ user_id: owner.id, display_name: "fake" })).error), "users cannot write a public profile directly");
  check(((await me.from("mahdi_posts").select("id").eq("id", ids.post!)).data ?? []).length === 1, "posts are visible to signed-in users");
  check(await none(me.from("mahdi_posts").select("id").eq("id", ids.hiddenPost!)), "a hidden post is not visible to others");
  check((await me.from("mahdi_post_reports").select("post_id")).error !== null, "users cannot read reports");
  check((await me.from("mahdi_religious_texts").select("id").eq("verification_status", "pending")).data?.length === 0, "unverified religious texts are never visible");
} finally {
  for (const id of [ids.post, ids.hiddenPost]) if (id) await admin.from("mahdi_posts").delete().eq("id", id);
  if (ids.sub) await admin.from("mahdi_push_subscriptions").delete().eq("id", ids.sub);
  for (const id of [ids.challenge, ids.draft]) if (id) await admin.from("mahdi_challenges").delete().eq("id", id); // members and logs go with it
  if (ids.section) await admin.from("mahdi_challenge_sections").delete().eq("id", ids.section);
  if (!otherHadPrivacy) await admin.from("mahdi_privacy").delete().eq("user_id", other.id);
  if (!otherHadNotif) await admin.from("mahdi_notification_settings").delete().eq("user_id", other.id);
  if (!otherHadPublic) await admin.from("mahdi_public_profiles").delete().eq("user_id", other.id);
  if (myProjectId) await admin.from("mahdi_projects").delete().eq("id", myProjectId);
  await admin.from("mahdi_projects").delete().eq("id", theirProject.id);
  if (!otherHadProfile) await admin.from("mahdi_profiles").delete().eq("user_id", other.id);
  console.log("🧹 test data removed");
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
