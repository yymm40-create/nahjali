// SERVER ONLY. «عائلتي»: a parent adds family members, each a full account of its own (projects, scores,
// comparisons, posts) without an e-mail. The parent enters a member's account freely; going back to the parent, or
// to a brother or sister, asks for the parent's PIN (salted scrypt hash, five wrong tries lock it for 15 minutes).
// Switching = a one-time sign-in link made and used on the server, so the browser simply holds the other session.
import { randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { RESERVED_USERNAMES, suggestUsername } from "@/lib/username-rules";
import { t } from "../i18n";
import { UserError } from "./api";
import { avatarUrl } from "./rows";
import { notMigrated } from "./social";

const db = () => createAdminClient();
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const F = () => t.family;
export const FAMILY_MAX = 8;
const LOCK = { tries: 5, minutes: 15 };
/** Members have no real e-mail: a reserved domain that can never receive mail. */
const memberEmail = () => `member-${randomUUID()}@family.nahjali.invalid`;

export interface FamilyPerson {
  id: string;
  name: string;
  avatarUrl: string | null;
  username: string | null;
  parent: boolean;
}

export interface FamilyView {
  /** "parent": I added members · "member": I am one · null: no family yet. */
  role: "parent" | "member" | null;
  me: string;
  people: FamilyPerson[];
  hasPin: boolean;
  max: number;
}

async function hashPin(pin: string) {
  const salt = randomBytes(16);
  return `s1$${salt.toString("hex")}$${(await scrypt(pin, salt, 32)).toString("hex")}`;
}
async function pinMatches(pin: string, stored: string) {
  const [v, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const got = await scrypt(pin, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(hash, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}
const cleanPin = (v: unknown) => (typeof v === "string" && /^\d{4,8}$/.test(v) ? v : null);

/** My family: the parent first, then the members in the order they were added. */
export async function familyView(userId: string): Promise<FamilyView> {
  const { data: asMember, error } = await db().from("mahdi_family").select("parent_id").eq("member_id", userId).maybeSingle();
  if (error) {
    if (notMigrated(error)) throw new UserError(F().notReady, 503);
    throw error;
  }
  const parentId = (asMember?.parent_id as string | undefined) ?? userId;
  const { data: rows } = await db().from("mahdi_family").select("member_id").eq("parent_id", parentId).order("created_at");
  const ids = [parentId, ...(rows ?? []).map((r) => r.member_id as string)];
  const [profiles, handles, settings] = await Promise.all([
    db().from("mahdi_profiles").select("user_id, display_name, avatar_path").in("user_id", ids),
    db().from("site_usernames").select("user_id, username").in("user_id", ids),
    db().from("mahdi_family_settings").select("parent_id").eq("parent_id", parentId).maybeSingle(),
  ]);
  const people = ids.map((id) => {
    const p = (profiles.data ?? []).find((x) => x.user_id === id);
    return {
      id,
      name: (p?.display_name as string) ?? "",
      avatarUrl: avatarUrl((p?.avatar_path as string | null) ?? null),
      username: ((handles.data ?? []).find((x) => x.user_id === id)?.username as string) ?? null,
      parent: id === parentId,
    };
  });
  return { role: asMember ? "member" : rows?.length ? "parent" : null, me: userId, people, hasPin: Boolean(settings.data), max: FAMILY_MAX };
}

/** Sets (or changes) the parent's PIN. Only the parent, signed in as themself. */
export async function setPin(parentId: string, pin: unknown) {
  const p = cleanPin(pin);
  if (!p) throw new UserError(F().pinRule, 400);
  const { data: asMember } = await db().from("mahdi_family").select("parent_id").eq("member_id", parentId).maybeSingle();
  if (asMember) throw new UserError(F().onlyParent, 403);
  const { error } = await db().from("mahdi_family_settings").upsert({ parent_id: parentId, pin_hash: await hashPin(p), failed: 0, locked_until: null, updated_at: new Date().toISOString() });
  if (error) throw notMigrated(error) ? new UserError(F().notReady, 503) : error;
}

/** A free username made from the member's name («علي» → «علي», «علي_2»…), or a plain one. */
async function freeUsername(name: string) {
  const base = suggestUsername(name) ?? "member";
  for (let i = 0; i < 50; i++) {
    const cand = i === 0 ? base : `${base.slice(0, 16)}_${i + 1}`;
    if (RESERVED_USERNAMES.has(cand)) continue;
    const { data } = await db().from("site_usernames").select("user_id").eq("username", cand).maybeSingle();
    if (!data) return cand;
  }
  return `member_${randomBytes(3).toString("hex")}`;
}

/** Adds a member with their own account and «لأجل المهدي» profile (the parent's calendar and look). */
export async function addMember(parentId: string, rawName: unknown) {
  const name = typeof rawName === "string" ? rawName.replace(/\s+/g, " ").trim().slice(0, 30) : "";
  if (!name) throw new UserError(F().nameRequired, 400);
  const view = await familyView(parentId);
  if (view.role === "member") throw new UserError(F().onlyParent, 403);
  if (!view.hasPin) throw new UserError(F().pinFirst, 400);
  if (view.people.length - 1 >= FAMILY_MAX) throw new UserError(F().full(FAMILY_MAX), 400);
  const { data: parent } = await db().from("mahdi_profiles").select("*").eq("user_id", parentId).maybeSingle();
  if (!parent) throw new UserError(t.errors.noProfile, 403);

  const { data: created, error } = await db().auth.admin.createUser({ email: memberEmail(), email_confirm: true, user_metadata: { full_name: name, family_parent: parentId } });
  if (error || !created.user) throw new UserError(F().failed, 502);
  const id = created.user.id;
  try {
    const profile = { user_id: id, display_name: name, shrine_id: parent.shrine_id, theme: parent.theme, theme_variant: parent.theme_variant ?? "", time_zone: parent.time_zone, week_start: parent.week_start, show_hijri: parent.show_hijri, hijri_offset: parent.hijri_offset };
    const steps = [
      await db().from("mahdi_profiles").insert(profile),
      await db().from("site_usernames").insert({ user_id: id, username: await freeUsername(name) }),
      await db().from("mahdi_family").insert({ member_id: id, parent_id: parentId }),
    ];
    const bad = steps.find((s) => s.error);
    if (bad?.error) throw bad.error;
  } catch (e) {
    await db().auth.admin.deleteUser(id).catch(() => {});
    throw e;
  }
  return id;
}

/** Removes a member and everything in their account. Only the parent. */
export async function removeMember(parentId: string, memberId: string) {
  const { data } = await db().from("mahdi_family").select("member_id").eq("member_id", memberId).eq("parent_id", parentId).maybeSingle();
  if (!data) throw new UserError(t.errors.notFound, 404);
  const { error } = await db().auth.admin.deleteUser(memberId);
  if (error) throw new UserError(F().failed, 502);
}

/** Checks the parent's PIN, counting wrong tries. */
async function checkPin(parentId: string, pin: unknown) {
  const { data: s } = await db().from("mahdi_family_settings").select("*").eq("parent_id", parentId).maybeSingle();
  if (!s) throw new UserError(F().pinFirst, 400);
  if (s.locked_until && new Date(s.locked_until).getTime() > Date.now()) throw new UserError(F().locked(LOCK.minutes), 429);
  const p = cleanPin(pin);
  if (p && (await pinMatches(p, s.pin_hash))) {
    if (s.failed) await db().from("mahdi_family_settings").update({ failed: 0, locked_until: null }).eq("parent_id", parentId);
    return;
  }
  const failed = (s.failed ?? 0) + 1;
  const lock = failed >= LOCK.tries;
  await db()
    .from("mahdi_family_settings")
    .update({ failed: lock ? 0 : failed, locked_until: lock ? new Date(Date.now() + LOCK.minutes * 60_000).toISOString() : null })
    .eq("parent_id", parentId);
  throw new UserError(lock ? F().locked(LOCK.minutes) : F().wrongPin, lock ? 429 : 403);
}

/**
 * Moves this browser into another account of the family. From the parent to a member: no PIN. From a member to the
 * parent or to another member: the parent's PIN.
 */
export async function switchTo(currentId: string, targetId: string, pin: unknown) {
  if (targetId === currentId) return;
  const view = await familyView(currentId);
  const target = view.people.find((p) => p.id === targetId);
  if (!target) throw new UserError(t.errors.notFound, 404);
  const parentId = view.people.find((p) => p.parent)!.id;
  if (currentId !== parentId) await checkPin(parentId, pin);

  const { data: u } = await db().auth.admin.getUserById(targetId);
  const email = u?.user?.email;
  if (!email) throw new UserError(F().failed, 502);
  const { data: link, error } = await db().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !link?.properties?.hashed_token) throw new UserError(F().failed, 502);
  const supabase = await createClient();
  const { error: e2 } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (e2) throw new UserError(F().failed, 502);
}
