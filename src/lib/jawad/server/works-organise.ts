// «الجواد الذكي!» | JAWAD AI — «ترتيب أعمالي», the database side: the person's folders, and each work's folder and ⭐
// (migration 0113). Server only. Until 0113 runs every read answers «not ready» and the studio hides folders and
// favourites; nothing here throws for a missing table.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanFolderName, folderNameProblem, folderProblem, markProblem, type WorkFolder, type WorkMark, type WorksView } from "../works-organise";
import type { WorkItem, WorksFilter } from "../labels";
import { isUuid } from "./uploads";

const db = () => createAdminClient();
/** The table or function of 0113 isn't there yet. */
export const notOrganised = (e: unknown) => ["42P01", "42883", "PGRST202", "PGRST205"].includes((e as { code?: string } | null)?.code ?? "");
const NOT_READY = "ترتيب الأعمال (المجلدات والمفضلة) يتفعّل قريب.";

export type MarkType = "job" | "film";

interface FolderRow {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

async function folderRows(userId: string): Promise<FolderRow[] | null> {
  const { data, error } = await db().from("jawad_work_folders").select("id,user_id,name,created_at").eq("user_id", userId).order("created_at");
  if (notOrganised(error)) return null;
  if (error) throw error;
  return (data ?? []) as FolderRow[];
}

/** Whether 0113 has run, and the person's folders with how many works sit in each. */
export async function organiseState(userId: string): Promise<{ ready: boolean; folders: WorkFolder[]; favourites: number }> {
  const rows = await folderRows(userId);
  if (!rows) return { ready: false, folders: [], favourites: 0 };
  const { data, error } = await db().from("jawad_work_marks").select("folder_id,favourite").eq("user_id", userId).or("folder_id.not.is.null,favourite.eq.true").limit(20000);
  if (error && !notOrganised(error)) throw error;
  const counts = new Map<string, number>();
  let favourites = 0;
  for (const m of (data ?? []) as { folder_id: string | null; favourite: boolean }[]) {
    if (m.folder_id) counts.set(m.folder_id, (counts.get(m.folder_id) ?? 0) + 1);
    if (m.favourite) favourites++;
  }
  return { ready: true, folders: rows.map((f) => ({ id: f.id, name: f.name, count: counts.get(f.id) ?? 0 })), favourites };
}

async function requireRows(userId: string) {
  const rows = await folderRows(userId);
  if (!rows) throw new UserError(NOT_READY, 503);
  return rows;
}

export async function createFolder(userId: string, rawName: unknown): Promise<WorkFolder> {
  const rows = await requireRows(userId);
  const name = cleanFolderName(rawName);
  const why = folderNameProblem(name, rows);
  if (why) throw new UserError(why, 400);
  const { data, error } = await db().from("jawad_work_folders").insert({ user_id: userId, name }).select("id,name").single();
  if (error?.code === "23505") throw new UserError(`عندك مجلد اسمه «${name}».`, 400);
  if (error) throw error;
  return { id: data.id as string, name: data.name as string, count: 0 };
}

export async function renameFolder(userId: string, id: unknown, rawName: unknown): Promise<void> {
  const rows = await requireRows(userId);
  const folder = isUuid(id) ? rows.find((f) => f.id === id) ?? null : null;
  const own = folderProblem(userId, folder && { ownerId: folder.user_id });
  if (own) throw new UserError(own, 404);
  const name = cleanFolderName(rawName);
  const why = folderNameProblem(name, rows, folder!.id);
  if (why) throw new UserError(why, 400);
  const { error } = await db().from("jawad_work_folders").update({ name, updated_at: new Date().toISOString() }).eq("id", folder!.id).eq("user_id", userId);
  if (error?.code === "23505") throw new UserError(`عندك مجلد اسمه «${name}».`, 400);
  if (error) throw error;
}

/** Deletes a folder; its works stay in «أعمالي», out of any folder (the database sets their folder to none). */
export async function deleteFolder(userId: string, id: unknown): Promise<void> {
  const rows = await requireRows(userId);
  const folder = isUuid(id) ? rows.find((f) => f.id === id) ?? null : null;
  const own = folderProblem(userId, folder && { ownerId: folder.user_id });
  if (own) throw new UserError(own, 404);
  const { error } = await db().from("jawad_work_folders").delete().eq("id", folder!.id).eq("user_id", userId);
  if (error) throw error;
  // a work left with no folder and no ⭐ needs no row
  await db().from("jawad_work_marks").delete().eq("user_id", userId).is("folder_id", null).eq("favourite", false);
}

/** Who owns a work: a studio job's person, or a film picture/video's project owner (null: no such work). */
async function workOwner(type: MarkType, id: string): Promise<string | null> {
  if (type === "job") {
    const { data } = await db().from("jawad_jobs").select("user_id").eq("id", id).maybeSingle();
    return (data?.user_id as string | undefined) ?? null;
  }
  const { data } = await db().from("film_assets").select("project_id").eq("id", id).maybeSingle();
  if (!data?.project_id) return null;
  const { data: p } = await db().from("film_projects").select("user_id").eq("id", data.project_id).maybeSingle();
  return (p?.user_id as string | undefined) ?? null;
}

/**
 * Sets a work's folder (`folderId`: a folder of theirs, or null for none) and/or its ⭐ (`favourite`), leaving the other
 * as it was. Only the person's own work, only into their own folder. Returns the work's mark now.
 */
export async function setMark(userId: string, b: { type?: unknown; id?: unknown; folderId?: unknown; favourite?: unknown }): Promise<WorkMark> {
  const type: MarkType | null = b.type === "job" || b.type === "film" ? b.type : null;
  if (!type || !isUuid(b.id)) throw new UserError("ما لقينا هذا العمل في أعمالك.", 404);
  const folderId = b.folderId === null ? null : isUuid(b.folderId) ? b.folderId : undefined;
  if (b.folderId !== undefined && folderId === undefined) throw new UserError("ما لقينا هذا المجلد.", 404);
  const favourite = typeof b.favourite === "boolean" ? b.favourite : undefined;
  if (folderId === undefined && favourite === undefined) throw new UserError("طلب غير صحيح.", 400);

  const rows = await requireRows(userId);
  const folder = typeof folderId === "string" ? rows.find((f) => f.id === folderId) ?? null : null;
  const owner = await workOwner(type, b.id);
  const why = markProblem({ userId, item: owner ? { ownerId: owner } : null, folderId, folder: folder && { ownerId: folder.user_id } });
  if (why) throw new UserError(why, 404);

  const patch: Record<string, unknown> = { user_id: userId, item_type: type, item_id: b.id, updated_at: new Date().toISOString() };
  if (folderId !== undefined) patch.folder_id = folderId;
  if (favourite !== undefined) patch.favourite = favourite;
  // only the columns sent change on a work that already has a row (PostgREST merges them)
  const { data, error } = await db().from("jawad_work_marks").upsert(patch, { onConflict: "user_id,item_type,item_id" }).select("folder_id,favourite").single();
  if (notOrganised(error)) throw new UserError(NOT_READY, 503);
  if (error) throw error;
  const mark: WorkMark = { folderId: (data.folder_id as string | null) ?? null, favourite: Boolean(data.favourite) };
  if (!mark.folderId && !mark.favourite) await db().from("jawad_work_marks").delete().eq("user_id", userId).eq("item_type", type).eq("item_id", b.id);
  return mark;
}

const keyOf = (type: MarkType, id: string) => `${type}:${id}`;

/** The marks of a page of works, put on them (nothing when 0113 hasn't run: the fields stay absent). */
export async function withMarks(userId: string, items: WorkItem[]): Promise<WorkItem[]> {
  const ids = items.map((it) => it.id).filter(isUuid);
  if (!ids.length) return items;
  const { data, error } = await db().from("jawad_work_marks").select("item_type,item_id,folder_id,favourite").eq("user_id", userId).in("item_id", ids);
  if (error) {
    if (!notOrganised(error)) console.error("[jawad] work marks", error);
    return items;
  }
  const marks = new Map(((data ?? []) as { item_type: MarkType; item_id: string; folder_id: string | null; favourite: boolean }[]).map((m) => [keyOf(m.item_type, m.item_id), m]));
  return items.map((it) => {
    const m = marks.get(keyOf(it.type, it.id));
    return { ...it, folderId: m?.folder_id ?? null, favourite: Boolean(m?.favourite) };
  });
}

/**
 * One page of a folder's works and/or the favourites (ids with their time, in the order asked), or null when 0113
 * hasn't run (the caller then lists every work).
 */
export async function markedPage(userId: string, view: WorksView, filter: WorksFilter, after: string | null, limit: number): Promise<{ type: MarkType; id: string; at: string }[] | null> {
  const { data, error } = await db().rpc("jawad_marked_works", {
    p_user: userId,
    p_folder: view.folder,
    p_favourite: view.fav,
    p_kind: filter === "all" ? null : filter,
    p_after: after,
    p_oldest: view.sort === "old",
    p_limit: limit,
  });
  if (notOrganised(error)) return null;
  if (error) throw error;
  return ((data ?? []) as { item_type: MarkType; item_id: string; created_at: string }[]).map((r) => ({ type: r.item_type, id: r.item_id, at: r.created_at }));
}
