// «مسابقة الفيلم السينمائي» on the server: who may judge, a person's videos from the film maker, the entries, the
// participants' files (sheets and videos) and the three places. Server only (service role). Migration 0088.

import { UserError } from "@/lib/api";
import { createAdminClient, listAllUsers } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { isAdmin } from "@config/site";
import { FILM_BUCKET } from "@/lib/film/types";

const db = () => createAdminClient();

export interface ContestVideo {
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  url: string | null;
  at: string;
  entered: boolean;
}
export interface ContestSheet {
  id: string;
  projectTitle: string;
  title: string;
  url: string | null;
}

/** The owner, or someone the owner added as a judge. */
export async function isJudge(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (isAdmin(email)) return true;
  const { data } = await db().from("contest_judges").select("email").eq("email", email.toLowerCase()).maybeSingle();
  return Boolean(data);
}

/** The name shown for a person: their username, else the name on their account, else the start of their e-mail. */
export async function namesOf(ids: string[]): Promise<Map<string, { name: string; email: string }>> {
  const out = new Map<string, { name: string; email: string }>();
  if (!ids.length) return out;
  const [users, { data: names }] = await Promise.all([listAllUsers(), db().from("site_usernames").select("user_id,username").in("user_id", ids)]);
  const uname = new Map(((names ?? []) as { user_id: string; username: string }[]).map((n) => [n.user_id, n.username]));
  for (const u of users) {
    if (!ids.includes(u.id)) continue;
    const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
    const email = String(u.email ?? "");
    out.set(u.id, { name: String(meta.full_name || meta.name || uname.get(u.id) || email.split("@")[0] || "مشارك").trim(), email });
  }
  return out;
}

const sign = async (paths: string[]) => {
  if (!paths.length) return [] as (string | null)[];
  const { data } = await storage.from(FILM_BUCKET).createSignedUrls(paths, 6 * 3600);
  return paths.map((_, i) => data?.[i]?.signedUrl ?? null);
};

interface AssetRow {
  id: string;
  project_id: string;
  kind: string;
  ref_key: string;
  storage_path: string | null;
  status: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

/** A person's film-maker work: its finished videos (and, for the judges, its character sheets). */
async function workOf(userId: string) {
  const { data: projects } = await db().from("film_projects").select("id,title").eq("user_id", userId);
  const P = (projects ?? []) as { id: string; title: string }[];
  if (!P.length) return { P, A: [] as AssetRow[] };
  const { data: assets } = await db().from("film_assets").select("id,project_id,kind,ref_key,storage_path,status,meta,created_at").in("project_id", P.map((p) => p.id)).in("kind", ["video", "image"]).order("created_at", { ascending: false });
  const A = ((assets ?? []) as AssetRow[]).filter((a) => a.storage_path && !a.ref_key.startsWith("archive:") && (a.status === "generated" || a.status === "approved"));
  return { P, A };
}
const videoTitle = (ref: string) => (ref === "SCENE" ? "🎬 المشهد الكامل" : `🎞️ لقطة ${ref}`);

/** The person's own videos, each marked when it is in the contest. */
export async function myVideos(userId: string): Promise<ContestVideo[]> {
  const { P, A } = await workOf(userId);
  const vids = A.filter((a) => a.kind === "video");
  const { data: entries } = vids.length ? await db().from("contest_entries").select("asset_id").eq("user_id", userId) : { data: [] };
  const inn = new Set(((entries ?? []) as { asset_id: string }[]).map((e) => e.asset_id));
  const urls = await sign(vids.map((v) => v.storage_path!));
  const title = new Map(P.map((p) => [p.id, p.title]));
  return vids.map((v, i) => ({ id: v.id, projectId: v.project_id, projectTitle: title.get(v.project_id) ?? "", title: videoTitle(v.ref_key), url: urls[i], at: v.created_at, entered: inn.has(v.id) }));
}

/** «أضف إلى المنصة» / «اسحبه»: one of the person's own videos into (or out of) the contest. */
export async function setEntry(userId: string, assetId: unknown, on: boolean) {
  const id = String(assetId ?? "");
  const { data: a } = await db().from("film_assets").select("id,project_id,kind,status").eq("id", id).maybeSingle();
  if (!a || a.kind !== "video") throw new UserError("ما لقينا هذا الفيديو.", 404);
  const { data: p } = await db().from("film_projects").select("user_id").eq("id", a.project_id).maybeSingle();
  if (!p || p.user_id !== userId) throw new UserError("هذا الفيديو مو لك.", 403);
  if (on) {
    const { error } = await db().from("contest_entries").upsert({ asset_id: id, user_id: userId, project_id: a.project_id }, { onConflict: "asset_id" });
    if (error) throw new UserError("المسابقة ما تجهزت بعد (ملف 0088).", 503);
  } else await db().from("contest_entries").delete().eq("asset_id", id).eq("user_id", userId);
  return { ok: true };
}

/** For the judges: everyone with at least one entry, how many, and since when. */
export async function participants() {
  const { data, error } = await db().from("contest_entries").select("user_id,created_at").order("created_at");
  if (error) return { missing: true, people: [] as { userId: string; name: string; email: string; entries: number; since: string }[] };
  const rows = (data ?? []) as { user_id: string; created_at: string }[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const names = await namesOf(ids);
  return { missing: false, people: ids.map((id) => ({ userId: id, name: names.get(id)?.name ?? "مشارك", email: names.get(id)?.email ?? "", entries: rows.filter((r) => r.user_id === id).length, since: rows.find((r) => r.user_id === id)!.created_at })) };
}

/** A participant's file: their character sheets and their videos (only those), each video marked if entered. */
export async function participantFile(userId: string) {
  const { P, A } = await workOf(userId);
  const title = new Map(P.map((p) => [p.id, p.title]));
  // sheets: the approved/generated pictures of the sheets step (not style tests)
  const sheetsA = A.filter((a) => a.kind === "image" && a.ref_key && a.ref_key !== "STYLE-TEST");
  const vids = await myVideos(userId);
  const urls = await sign(sheetsA.map((s) => s.storage_path!));
  const sheets: ContestSheet[] = sheetsA.map((s, i) => ({ id: s.id, projectTitle: title.get(s.project_id) ?? "", title: `شيت ${s.ref_key}`, url: urls[i] }));
  const who = (await namesOf([userId])).get(userId);
  return { name: who?.name ?? "مشارك", email: who?.email ?? "", sheets, videos: vids };
}

/** Every entry, grouped by person (one card each), with the places as they stand. */
export async function allEntries() {
  const { data, error } = await db().from("contest_entries").select("asset_id,user_id,project_id,created_at").order("created_at");
  if (error) return { missing: true, groups: [] as { userId: string; name: string; videos: (ContestVideo & { place: number | null })[] }[] };
  const rows = (data ?? []) as { asset_id: string; user_id: string; project_id: string; created_at: string }[];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const [names, { data: assets }, { data: projects }, { data: winners }] = await Promise.all([
    namesOf(ids),
    rows.length ? db().from("film_assets").select("id,ref_key,storage_path").in("id", rows.map((r) => r.asset_id)) : Promise.resolve({ data: [] }),
    rows.length ? db().from("film_projects").select("id,title").in("id", [...new Set(rows.map((r) => r.project_id))]) : Promise.resolve({ data: [] }),
    db().from("contest_winners").select("place,asset_id"),
  ]);
  const byId = new Map(((assets ?? []) as { id: string; ref_key: string; storage_path: string | null }[]).map((a) => [a.id, a]));
  const title = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const place = new Map(((winners ?? []) as { place: number; asset_id: string }[]).map((w) => [w.asset_id, w.place]));
  const urls = await sign(rows.map((r) => byId.get(r.asset_id)?.storage_path ?? "").filter(Boolean));
  let k = 0;
  const vids = rows.map((r) => {
    const a = byId.get(r.asset_id);
    const url = a?.storage_path ? urls[k++] : null;
    return { userId: r.user_id, v: { id: r.asset_id, projectId: r.project_id, projectTitle: title.get(r.project_id) ?? "", title: videoTitle(a?.ref_key ?? ""), url, at: r.created_at, entered: true, place: place.get(r.asset_id) ?? null } };
  });
  return { missing: false, groups: ids.map((id) => ({ userId: id, name: names.get(id)?.name ?? "مشارك", videos: vids.filter((x) => x.userId === id).map((x) => x.v) })) };
}

/** The owner sets a place (1–3) to an entered video, or clears it (assetId empty). */
export async function setPlace(place: unknown, assetId: unknown) {
  const p = Number(place);
  if (![1, 2, 3].includes(p)) throw new UserError("المركز لازم يكون ١ أو ٢ أو ٣.", 400);
  const id = String(assetId ?? "");
  if (!id) {
    await db().from("contest_winners").delete().eq("place", p);
    return { ok: true };
  }
  const { data: e } = await db().from("contest_entries").select("asset_id,user_id").eq("asset_id", id).maybeSingle();
  if (!e) throw new UserError("هذا الفيديو مو في المسابقة.", 404);
  // one video holds one place: taking a new place frees the old one
  await db().from("contest_winners").delete().eq("asset_id", id);
  const { error } = await db().from("contest_winners").upsert({ place: p, asset_id: id, user_id: e.user_id, set_at: new Date().toISOString() }, { onConflict: "place" });
  if (error) throw new UserError("ما قدرنا نحفظ المركز (ملف 0088).", 503);
  return { ok: true };
}

/** The three places as the site shows them (empty until the owner picks). */
export async function winners(): Promise<{ place: number; name: string; projectTitle: string; url: string | null }[]> {
  const { data, error } = await db().from("contest_winners").select("place,asset_id,user_id").order("place");
  if (error || !data?.length) return [];
  const W = data as { place: number; asset_id: string; user_id: string }[];
  const [{ data: assets }, names] = await Promise.all([db().from("film_assets").select("id,project_id,storage_path").in("id", W.map((w) => w.asset_id)), namesOf(W.map((w) => w.user_id))]);
  const A = new Map(((assets ?? []) as { id: string; project_id: string; storage_path: string | null }[]).map((a) => [a.id, a]));
  const { data: projects } = await db().from("film_projects").select("id,title").in("id", [...A.values()].map((a) => a.project_id));
  const T = new Map(((projects ?? []) as { id: string; title: string }[]).map((p) => [p.id, p.title]));
  const urls = await sign(W.map((w) => A.get(w.asset_id)?.storage_path ?? "").filter(Boolean));
  let k = 0;
  return W.map((w) => {
    const a = A.get(w.asset_id);
    return { place: w.place, name: names.get(w.user_id)?.name ?? "مشارك", projectTitle: a ? T.get(a.project_id) ?? "" : "", url: a?.storage_path ? urls[k++] : null };
  });
}

/** The judges the owner added (the owner is always one). */
export async function judges(): Promise<string[]> {
  const { data } = await db().from("contest_judges").select("email").order("created_at");
  return ((data ?? []) as { email: string }[]).map((j) => j.email);
}
export async function setJudge(email: unknown, on: boolean) {
  const e = String(email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new UserError("اكتب إيميل صحيح.", 400);
  const r = on ? await db().from("contest_judges").upsert({ email: e }) : await db().from("contest_judges").delete().eq("email", e);
  if (r.error) throw new UserError("المسابقة ما تجهزت بعد (ملف 0088).", 503);
  return { ok: true };
}
