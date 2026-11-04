// «اسمح للأدمن بالدخول على مشروعك» (migration 0103): an admin asks to work on someone's film project, the owner sees
// the request on the site and allows or refuses it. Allowed: the project opens in the admin's own film maker, and
// everything he does there is done on the owner's project itself. The owner (or the admin) stops it any time.
// Server only. Before the migration runs the table is missing and every read here comes back empty.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";

const db = () => createAdminClient();
const TABLE = "film_project_access";

export type AccessStatus = "pending" | "approved" | "declined" | "revoked";
export interface AccessRow {
  id: string;
  project_id: string;
  owner_id: string;
  admin_id: string;
  status: AccessStatus;
  created_at: string;
  decided_at: string | null;
}
type Who = { id: string; email?: string | null };

/** Whether this admin was allowed into this project (and is still an admin). */
export async function hasAdminAccess(projectId: string, user: Who | string) {
  const id = typeof user === "string" ? user : user.id;
  const { data, error } = await db().from(TABLE).select("id").eq("project_id", projectId).eq("admin_id", id).eq("status", "approved").maybeSingle();
  return !error && Boolean(data);
}

/** The admin asks the owner of a project for access (asking again after a refusal or a stop asks again). */
export async function requestAccess(admin: Who, projectId: string) {
  if (!isAdmin(admin.email)) throw new UserError("هذا للأدمن بس.", 403);
  if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new UserError("مشروع غير صحيح.", 400);
  const { data: p } = await db().from("film_projects").select("id,user_id").eq("id", projectId).maybeSingle();
  if (!p) throw new UserError("ما لقينا المشروع.", 404);
  if (p.user_id === admin.id) throw new UserError("هذا مشروعك أصلًا.", 409);
  const { data: old, error: readErr } = await db().from(TABLE).select("*").eq("project_id", projectId).eq("admin_id", admin.id).maybeSingle();
  if (readErr) throw new UserError("ميزة طلب الدخول تحتاج تشغيل migration 0103 أول.", 503);
  if (old?.status === "approved") return old as AccessRow;
  const row = { project_id: projectId, owner_id: p.user_id as string, admin_id: admin.id, status: "pending" as const, created_at: new Date().toISOString(), decided_at: null };
  const { data, error } = old
    ? await db().from(TABLE).update(row).eq("id", old.id).select("*").single()
    : await db().from(TABLE).insert(row).select("*").single();
  if (error) throw error;
  return data as AccessRow;
}

/** The owner answers a request: allow or refuse. */
export async function answerAccess(owner: Who, id: string, allow: boolean) {
  const { data: r } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (!r || r.owner_id !== owner.id) throw new UserError("ما لقينا الطلب.", 404);
  if (r.status !== "pending") throw new UserError("هذا الطلب انرد عليه من قبل.", 409);
  const { error } = await db().from(TABLE).update({ status: allow ? "approved" : "declined", decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending");
  if (error) throw error;
}

/** The owner takes the access back, or the admin leaves the project. */
export async function revokeAccess(user: Who, id: string) {
  const { data: r } = await db().from(TABLE).select("*").eq("id", id).maybeSingle();
  if (!r || (r.owner_id !== user.id && r.admin_id !== user.id)) throw new UserError("ما لقينا الطلب.", 404);
  if (r.status === "revoked" || r.status === "declined") return;
  const { error } = await db().from(TABLE).update({ status: "revoked", decided_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

const titles = async (ids: string[]) => {
  if (!ids.length) return {} as Record<string, string>;
  const { data } = await db().from("film_projects").select("id,title").in("id", ids);
  return Object.fromEntries((data ?? []).map((p) => [p.id as string, p.title as string]));
};

/** Requests waiting for this owner's answer, with the project's title. */
export async function pendingForOwner(ownerId: string) {
  const { data, error } = await db().from(TABLE).select("*").eq("owner_id", ownerId).eq("status", "pending").order("created_at", { ascending: false }).limit(10);
  if (error || !data?.length) return [];
  const t = await titles(data.map((r) => r.project_id as string));
  return (data as AccessRow[]).map((r) => ({ id: r.id, projectId: r.project_id, title: t[r.project_id] ?? "مشروعك", at: r.created_at }));
}

/** The projects this admin was allowed into, with their owners' e-mail. */
export async function sharedWithAdmin(adminId: string) {
  const { data, error } = await db().from(TABLE).select("*").eq("admin_id", adminId).eq("status", "approved").order("decided_at", { ascending: false });
  if (error || !data?.length) return [];
  const rows = data as AccessRow[];
  const { data: projects } = await db().from("film_projects").select("id,title,stage,updated_at,user_id,series_id").in("id", rows.map((r) => r.project_id));
  const emails = await Promise.all(rows.map((r) => db().auth.admin.getUserById(r.owner_id).then((u) => u.data.user?.email ?? "").catch(() => "")));
  return rows.flatMap((r, i) => {
    const p = (projects ?? []).find((x) => x.id === r.project_id);
    return p ? [{ accessId: r.id, id: p.id as string, title: p.title as string, stage: p.stage as string, updated_at: p.updated_at as string, ownerEmail: emails[i], seriesId: (p.series_id as string | null) ?? null }] : [];
  });
}

/** Every request about one project (for its owner's page and the admin's page). */
export async function accessOfProject(projectId: string) {
  const { data, error } = await db().from(TABLE).select("*").eq("project_id", projectId).order("created_at", { ascending: false });
  return error ? [] : ((data ?? []) as AccessRow[]);
}

/** This admin's requests, by project (for the dashboard's buttons). */
export async function requestsOfAdmin(adminId: string) {
  const { data, error } = await db().from(TABLE).select("id,project_id,status").eq("admin_id", adminId);
  const out: Record<string, { id: string; status: AccessStatus }> = {};
  if (!error) for (const r of data ?? []) out[r.project_id as string] = { id: r.id as string, status: r.status as AccessStatus };
  return out;
}
