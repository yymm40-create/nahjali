// Who may use what: the dashboard's ONE list (site_access, migration 0035). An email in it gets the sections ticked,
// free and unlimited; everyone else finds them closed («لأجل المهدي» isn't in it: open to all). The owner and the
// co-owner always have everything, and so does whoever entered «الكود السري» while that code stays on. Server only.

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { ALL_PERMS, isPerm, type Perm } from "@config/access";

export type { Perm };

// a short memory across requests (the list changes rarely; a change shows within seconds)
const memo = new Map<string, { at: number; perms: Set<Perm> }>();
const TTL = 15_000;

/** Every row of the list (the dashboard). */
export async function accessList(): Promise<{ email: string; perms: Perm[] }[]> {
  const { data, error } = await createAdminClient().from("site_access").select("email,perms").order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => ({ email: r.email as string, perms: ((r.perms as string[]) ?? []).filter(isPerm) }));
}

/** «الكود السري» now: on, with its id (null when off or not set up). */
let secretMemo: { at: number; id: string | null } | null = null;
export async function liveCodeId(): Promise<string | null> {
  if (secretMemo && Date.now() - secretMemo.at < TTL) return secretMemo.id;
  const { data, error } = await createAdminClient().from("site_secret").select("code,code_id,enabled").eq("id", 1).maybeSingle();
  if (error) return null;
  const id = data?.enabled && String(data.code ?? "").length > 0 ? (data.code_id as string) : null;
  secretMemo = { at: Date.now(), id };
  return id;
}

async function load(email: string): Promise<Set<Perm>> {
  const hit = memo.get(email);
  if (hit && Date.now() - hit.at < TTL) return hit.perms;
  const db = createAdminClient();
  const [{ data }, grant, live] = await Promise.all([
    db.from("site_access").select("perms").eq("email", email).maybeSingle(),
    db.from("site_code_grants").select("code_id").eq("email", email).maybeSingle(),
    liveCodeId(),
  ]);
  // came in by «الكود السري», and that very code is still on: everything
  const byCode = Boolean(live && grant.data?.code_id === live);
  const perms = new Set(byCode ? ALL_PERMS : ((data?.perms as string[] | undefined) ?? []).filter(isPerm));
  memo.set(email, { at: Date.now(), perms });
  return perms;
}

/** What this person may use (everything for the owner and co-owner; nothing signed out). */
export const accessOf = cache(async (email: string | null | undefined): Promise<Set<Perm>> => {
  const mail = email?.toLowerCase();
  if (!mail) return new Set();
  if (isAdmin(mail)) return new Set(ALL_PERMS);
  // the list can't be read (not set up yet, or down): closed, never a broken page
  return load(mail).catch(() => new Set<Perm>());
});

export const can = async (email: string | null | undefined, perm: Perm) => (await accessOf(email)).has(perm);

/** In the list at all (or an owner): such a person uses what they may for free, without limits. */
export const unlimitedFor = async (email: string | null | undefined) => (await accessOf(email)).size > 0;

/** After a change on the dashboard: forget what was remembered. */
export const forgetAccess = (email?: string) => {
  if (email) memo.delete(email.toLowerCase());
  else {
    memo.clear();
    secretMemo = null;
  }
};

/** The section a JAWAD AI generator belongs to. */
export function permForGenerator(def: { id: string; output: string }): Perm {
  if (def.output === "image") return "image";
  if (def.output === "video") return "video";
  return /sfx|music/.test(def.id) ? "music" : "voice";
}
