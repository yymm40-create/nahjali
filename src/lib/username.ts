// SERVER ONLY. Reading and claiming the site-wide @username.
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPublicProfile } from "@/lib/mahdi/server/public";
import { cleanUsername, RESERVED_USERNAMES, suggestUsername, USERNAME_RE, type UsernameProblem } from "./username-rules";

/** The user's username, or null (read with the user's own session, through RLS). */
export async function getUsername(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await supabase.from("site_usernames").select("username").eq("user_id", userId).maybeSingle();
  return data?.username ?? null;
}

/** Checks a wanted username. Returns the cleaned name, or the problem. */
export async function checkUsername(input: string, userId: string): Promise<{ name: string; problem: UsernameProblem | null }> {
  const name = cleanUsername(input);
  if (!USERNAME_RE.test(name)) return { name, problem: "invalid" };
  if (RESERVED_USERNAMES.has(name)) return { name, problem: "reserved" };
  const { data } = await createAdminClient().from("site_usernames").select("user_id").eq("username", name).maybeSingle();
  return { name, problem: data && data.user_id !== userId ? "taken" : null };
}

/** Sets (or changes) the username through the user's own session. Returns the problem, or null when saved. */
export async function claimUsername(supabase: SupabaseClient, userId: string, input: string): Promise<{ name: string; problem: UsernameProblem | null }> {
  const checked = await checkUsername(input, userId);
  if (checked.problem) return checked;
  const { error } = await supabase.from("site_usernames").upsert({ user_id: userId, username: checked.name });
  if (error) {
    if ((error as { code?: string }).code === "23505") return { name: checked.name, problem: "taken" };
    throw error;
  }
  // The community page of «لأجل المهدي» is found by this name
  await syncPublicProfile(userId).catch(() => {});
  return checked;
}

/**
 * Makes sure the account has a username, taken from the names it already has (the «لأجل المهدي» name, then the
 * Google name). Returns the username, or null when none is free: then the person has to choose one.
 */
export async function ensureUsername(supabase: SupabaseClient, user: User, extraNames: (string | null | undefined)[] = []): Promise<string | null> {
  const current = await getUsername(supabase, user.id);
  if (current) return current;
  const meta = user.user_metadata ?? {};
  const names = [...extraNames, meta.full_name, meta.name].filter((n): n is string => typeof n === "string" && n.trim().length > 0);
  for (const n of names) {
    const s = suggestUsername(n);
    if (!s) continue;
    const r = await claimUsername(supabase, user.id, s).catch(() => null);
    if (r && !r.problem) return r.name;
  }
  return null;
}

/** A name to suggest on the "choose a username" page. */
export function suggestionFor(user: User, extraNames: (string | null | undefined)[] = []): string {
  const meta = user.user_metadata ?? {};
  for (const n of [...extraNames, meta.full_name, meta.name, user.email?.split("@")[0]]) {
    const s = typeof n === "string" ? suggestUsername(n) : null;
    if (s) return s;
  }
  return "";
}

/**
 * After signing in: where to send someone who has no username yet. A new account always confirms its username
 * first; an older account gets its existing name as username, and only chooses when that name is taken.
 * Returns null when nothing is needed. Password resets are never interrupted.
 */
export async function usernameGate(supabase: SupabaseClient, user: User, next: string): Promise<string | null> {
  if (next.startsWith("/mahdi/reset")) return null;
  if (await getUsername(supabase, user.id)) return null;
  const isNew = Date.now() - new Date(user.created_at).getTime() < 15 * 60_000;
  if (!isNew) {
    const { data: profile } = await supabase.from("mahdi_profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    if (await ensureUsername(supabase, user, [profile?.display_name])) return null;
  }
  // «الجواد الذكي!» | JAWAD AI asks for it in its own identity
  const page = next === "/jawad-ai" || next.startsWith("/jawad-ai/") ? "/jawad-ai/username" : "/username";
  return `${page}?next=${encodeURIComponent(next)}`;
}
