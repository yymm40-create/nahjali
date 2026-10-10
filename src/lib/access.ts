// Who may use what: the dashboard's ONE list (site_access, migration 0035). An email in it gets the sections ticked,
// free and unlimited; everyone else finds them closed («لأجل المهدي» isn't in it: open to all). The owner and the
// co-owner always have everything, and so does whoever entered «الكود السري» while that code stays on. Server only.

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { ALL_PERMS, isPerm, OPEN_PERMS, PUBLIC_PERMS, permsByCodes, unlimitedByCodes, type Access, type CodeRow, type CodeUse, type Perm } from "@config/access";
import { isPublicOpen } from "@/lib/launch";

export type { Perm };

// a short memory across requests (the list changes rarely; a change shows within seconds)
const memo = new Map<string, { at: number; access: Access }>();
const TTL = 15_000;

/** Every row of the list (the dashboard). */
export async function accessList(): Promise<{ email: string; perms: Perm[]; unlimited: boolean }[]> {
  const { data, error } = await createAdminClient().from("site_access").select("*").order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((r) => ({ email: r.email as string, perms: ((r.perms as string[]) ?? []).filter(isPerm), unlimited: Boolean(r.unlimited) }));
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

/** The owner's codes («الأكواد») and who entered them, as the pure rules read them. */
export const codeFromRow = (r: Record<string, unknown>): CodeRow => ({
  id: r.id as string,
  label: String(r.label ?? ""),
  code: String(r.code ?? ""),
  perms: ((r.perms as string[]) ?? []).filter(isPerm),
  expiresAt: (r.expires_at as string | null) ?? null,
  validHours: (r.valid_hours as number | null) ?? null,
  maxUses: (r.max_uses as number | null) ?? null,
  enabled: Boolean(r.enabled),
  unlimited: Boolean(r.unlimited),
});

async function load(email: string): Promise<Access> {
  const hit = memo.get(email);
  if (hit && Date.now() - hit.at < TTL) return hit.access;
  const db = createAdminClient();
  const [{ data }, grant, live, uses, open] = await Promise.all([
    db.from("site_access").select("*").eq("email", email).maybeSingle(),
    db.from("site_code_grants").select("code_id").eq("email", email).maybeSingle(),
    liveCodeId(),
    db.from("site_code_uses").select("code_id,email,at").eq("email", email),
    isPublicOpen().catch(() => false),
  ]);
  // came in by «الكود السري», and that very code is still on: everything (but what only opens by name)
  const byCode = Boolean(live && grant.data?.code_id === live);
  const mine: CodeUse[] = (uses.data ?? []).map((u) => ({ codeId: u.code_id as string, email: u.email as string, at: u.at as string }));
  // the owner's codes this person entered: each opens only its own sections, while it lives (a missing table = none)
  const codes = mine.length ? ((await db.from("site_codes").select("*").in("id", mine.map((u) => u.codeId))).data ?? []).map(codeFromRow) : [];
  // the site is open to everyone (the owner's launch switch): every section, paid from the wallet
  const perms = new Set<Perm>([...(open ? PUBLIC_PERMS : []), ...(byCode ? OPEN_PERMS : []), ...((data?.perms as string[] | undefined) ?? []).filter(isPerm), ...permsByCodes(codes, mine)]);
  // free («بلا حدود»): the all-opening code, the e-mail marked so, or an unlimited code that still opens
  const unlimited = byCode || Boolean(data?.unlimited) || unlimitedByCodes(codes, mine);
  const access = { perms, unlimited };
  memo.set(email, { at: Date.now(), access });
  return access;
}

/** The whole access of this person: the sections, and whether they make for free. */
export const fullAccessOf = cache(async (email: string | null | undefined): Promise<Access> => {
  const mail = email?.toLowerCase();
  if (!mail) return { perms: new Set(), unlimited: false };
  if (isAdmin(mail)) return { perms: new Set(ALL_PERMS), unlimited: true };
  return load(mail).catch(() => ({ perms: new Set<Perm>(), unlimited: false }));
});

/** What this person may use (everything for the owner and co-owner; nothing signed out). */
export const accessOf = cache(async (email: string | null | undefined): Promise<Set<Perm>> => {
  const mail = email?.toLowerCase();
  if (!mail) return new Set();
  if (isAdmin(mail)) return new Set(ALL_PERMS);
  // the list can't be read (not set up yet, or down): closed, never a broken page
  return load(mail).then((a) => a.perms).catch(() => new Set<Perm>());
});

export const can = async (email: string | null | undefined, perm: Perm) => (await accessOf(email)).has(perm);

/** Makes for free, without a wallet: the owners, the all-opening code, an e-mail or a code marked «بلا حدود». */
export const unlimitedFor = async (email: string | null | undefined) => (await fullAccessOf(email)).unlimited;

/** Has something open (any section, named-only ones included): the secret-code question isn't asked again. */
export const hasAnyAccess = async (email: string | null | undefined) => (await accessOf(email)).size > 0;

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
