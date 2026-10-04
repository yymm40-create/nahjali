// SERVER ONLY. «لأجل المهدي» · people, follows, posts, comments, views and reports.
// Reads of posts, comments and stories go through the reader's own RLS client, so the database decides who may see
// what (public.mahdi_can_see). Counts, profiles and links are then added with the service role.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SharePayload } from "../client/share";
import { t } from "../i18n";
import type { CommentView, FollowState, PostView, ProfileView, ReportCategory, SocialUser } from "../social";
import { UserError } from "./api";
import { missingTable, notify, ownerIds } from "./inbox";
import { removeMedia, signMedia } from "./media";

const db = () => createAdminClient();
const S = () => t.social;
export const POSTS_PAGE = 20;
/** Reports that hide a post or story until the owner looks at it. */
export const AUTO_HIDE_REPORTS = 3;

/** True when the error says a column or table of migration 0020 is not there yet. */
export const notMigrated = (e: unknown) => missingTable(e) || ["42703", "PGRST204"].includes((e as { code?: string } | null)?.code ?? "");

interface ProfileRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  frame: string;
  username?: string | null;
}
const toUser = (r: ProfileRow): SocialUser => ({ id: r.user_id, username: r.username ?? null, displayName: r.display_name, avatarUrl: r.avatar_url, frame: r.frame ?? "" });

/** Public profiles by id (people who left the community are simply missing). */
export async function usersById(ids: string[]): Promise<Map<string, SocialUser>> {
  const list = [...new Set(ids)];
  if (!list.length) return new Map();
  const { data } = await db().from("mahdi_public_profiles").select("*").in("user_id", list);
  return new Map(((data ?? []) as ProfileRow[]).map((r) => [r.user_id, toUser(r)]));
}

export async function userByUsername(username: string): Promise<SocialUser | null> {
  const name = username.trim().replace(/^@/, "");
  if (!name || name.length > 30) return null;
  const { data, error } = await db().from("mahdi_public_profiles").select("*").ilike("username", name.replace(/[%_\\]/g, "\\$&")).limit(1).maybeSingle();
  if (error) {
    if (notMigrated(error)) throw new UserError(S().notReady, 503);
    throw error;
  }
  return data ? toUser(data as ProfileRow) : null;
}

export async function isPrivate(userId: string) {
  const { data } = await db().from("mahdi_privacy").select("*").eq("user_id", userId).maybeSingle();
  return Boolean((data as { private_account?: boolean } | null)?.private_account);
}

async function followRow(follower: string, followee: string) {
  const { data } = await db().from("mahdi_follows").select("status").eq("follower_id", follower).eq("followee_id", followee).maybeSingle();
  return (data?.status as "accepted" | "pending" | undefined) ?? null;
}

/** The people I follow (accepted). */
export async function followingIds(me: string): Promise<string[] | null> {
  const { data, error } = await db().from("mahdi_follows").select("followee_id").eq("follower_id", me).eq("status", "accepted").limit(5000);
  if (error) return notMigrated(error) ? null : Promise.reject(error);
  return (data ?? []).map((r) => r.followee_id as string);
}

export async function profileView(supabase: SupabaseClient, me: string, user: SocialUser): Promise<ProfileView> {
  const self = me === user.id;
  const [mine, theirs, priv, canSee] = await Promise.all([
    self ? null : followRow(me, user.id),
    self ? null : followRow(user.id, me),
    isPrivate(user.id),
    supabase.rpc("mahdi_can_see", { p_author: user.id }),
  ]);
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [posts, followers, following] = await Promise.all([
    count(db().from("mahdi_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("hidden_at", null)),
    count(db().from("mahdi_follows").select("follower_id", { count: "exact", head: true }).eq("followee_id", user.id).eq("status", "accepted")),
    count(db().from("mahdi_follows").select("followee_id", { count: "exact", head: true }).eq("follower_id", user.id).eq("status", "accepted")),
  ]);
  const state: FollowState = self ? "self" : mine === "accepted" ? "following" : mine === "pending" ? "pending" : "none";
  const view: ProfileView = { user, state, followsMe: theirs === "accepted", private: priv, canSee: self || Boolean(canSee.data), counts: { posts, followers, following } };
  if (self) view.requests = await peopleOf(user.id, "requests");
  return view;
}

/** Followers, following, or (my own) pending requests. */
export async function peopleOf(userId: string, list: "followers" | "following" | "requests"): Promise<SocialUser[]> {
  const q = db().from("mahdi_follows").select("follower_id, followee_id, created_at").order("created_at", { ascending: false }).limit(500);
  const { data } =
    list === "following"
      ? await q.eq("follower_id", userId).eq("status", "accepted")
      : await q.eq("followee_id", userId).eq("status", list === "requests" ? "pending" : "accepted");
  const ids = (data ?? []).map((r) => (list === "following" ? r.followee_id : r.follower_id) as string);
  const users = await usersById(ids);
  return ids.flatMap((id) => (users.has(id) ? [users.get(id)!] : []));
}

/** Follow, unfollow, cancel a request, accept or decline one, or remove a follower. Returns the new state. */
export async function followAction(me: SocialUser, other: SocialUser, action: string): Promise<FollowState> {
  if (me.id === other.id) throw new UserError(t.errors.invalid, 400);
  const N = S().notify;
  const href = (u: SocialUser) => (u.username ? `/mahdi/u/${encodeURIComponent(u.username)}` : "/mahdi/community");
  switch (action) {
    case "follow": {
      const now = await followRow(me.id, other.id);
      if (now) return now === "accepted" ? "following" : "pending";
      const status = (await isPrivate(other.id)) ? "pending" : "accepted";
      const { error } = await db().from("mahdi_follows").insert({ follower_id: me.id, followee_id: other.id, status });
      if (error && error.code !== "23505") throw notMigrated(error) ? new UserError(S().notReady, 503) : error;
      await notify([other.id], status === "pending" ? { kind: "follow_request", title: N.request(me.displayName), url: `${href(other)}?requests=1` } : { kind: "follow", title: N.follow(me.displayName), url: href(me) });
      return status === "pending" ? "pending" : "following";
    }
    case "unfollow":
      await db().from("mahdi_follows").delete().eq("follower_id", me.id).eq("followee_id", other.id);
      return "none";
    case "accept": {
      const { data } = await db().from("mahdi_follows").update({ status: "accepted" }).eq("follower_id", other.id).eq("followee_id", me.id).eq("status", "pending").select("follower_id");
      if (data?.length) await notify([other.id], { kind: "follow_accepted", title: N.accepted(me.displayName), url: href(me) });
      return (await followRow(me.id, other.id)) === "accepted" ? "following" : "none";
    }
    case "decline":
    case "remove":
      await db().from("mahdi_follows").delete().eq("follower_id", other.id).eq("followee_id", me.id);
      return (await followRow(me.id, other.id)) === "accepted" ? "following" : "none";
    default:
      throw new UserError(t.errors.invalid, 400);
  }
}

interface PostRow {
  id: string;
  user_id: string;
  kind: string;
  payload: Record<string, unknown> | null;
  closing: string;
  caption?: string;
  media_path?: string | null;
  media_kind?: "image" | "video" | null;
  media_ms?: number | null;
  width?: number | null;
  height?: number | null;
  views?: number;
  comments?: number;
  created_at: string;
}

/** Posts as the reader sees them: author, media links, «أحسنت», comments and views. */
export async function postViews(rows: PostRow[], me: string): Promise<PostView[]> {
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const [users, links, { data: reactions }] = await Promise.all([
    usersById(rows.map((p) => p.user_id)),
    signMedia(rows.map((p) => p.media_path)),
    db().from("mahdi_post_reactions").select("post_id, user_id").in("post_id", ids).eq("kind", "ahsant"),
  ]);
  return rows.map((p) => {
    const rs = (reactions ?? []).filter((r) => r.post_id === p.id);
    const author = users.get(p.user_id) ?? { id: p.user_id, username: null, displayName: "", avatarUrl: null, frame: "" };
    const url = p.media_path ? links.get(p.media_path) : undefined;
    return {
      id: p.id,
      mine: p.user_id === me,
      author,
      kind: p.kind,
      payload: p.kind === "photo" || p.kind === "video" || p.kind === "quote" ? null : (p.payload as unknown as SharePayload),
      closing: p.closing ?? "",
      caption: p.caption ?? "",
      quote: p.kind === "quote" ? { text: String(p.payload?.text ?? ""), by: String(p.payload?.by ?? "") } : null,
      media: url && p.media_kind ? { kind: p.media_kind, url, width: p.width ?? null, height: p.height ?? null, ms: p.media_ms ?? null } : null,
      createdAt: p.created_at,
      ahsant: rs.length,
      ahsantByMe: rs.some((r) => r.user_id === me),
      comments: p.comments ?? 0,
      views: p.views ?? 0,
    };
  });
}

/** One page of a feed: «following» (people I follow and me), «explore» (public accounts) or one person's posts. */
export async function feed(supabase: SupabaseClient, me: string, o: { kind: "following" | "explore" | "user"; userId?: string; before?: string | null }) {
  let q = supabase.from("mahdi_posts").select("*").is("hidden_at", null).order("created_at", { ascending: false }).limit(POSTS_PAGE);
  if (o.before && !Number.isNaN(Date.parse(o.before))) q = q.lt("created_at", new Date(o.before).toISOString());
  if (o.kind === "user") q = q.eq("user_id", o.userId!);
  else if (o.kind === "following") {
    const ids = await followingIds(me);
    // Before migration 0020 there are no follows: everyone's posts, as before
    if (ids) q = q.in("user_id", [...ids, me]);
  } else {
    const { data: priv, error } = await db().from("mahdi_privacy").select("user_id").eq("private_account", true).limit(5000);
    const hide = error ? [] : (priv ?? []).map((r) => r.user_id as string).filter((id) => id !== me);
    if (hide.length) q = q.not("user_id", "in", `(${hide.join(",")})`);
  }
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as PostRow[];
  return { posts: await postViews(rows, me), more: rows.length === POSTS_PAGE };
}

/** A post the reader may see (RLS), or 404. */
export async function visiblePost(supabase: SupabaseClient, id: string): Promise<PostRow> {
  const { data } = await supabase.from("mahdi_posts").select("*").eq("id", id).maybeSingle();
  if (!data) throw new UserError(t.errors.notFound, 404);
  return data as PostRow;
}

/** «أحسنت» on or off. The author hears about it once per person. */
export async function ahsant(supabase: SupabaseClient, me: SocialUser, postId: string, on: boolean) {
  const post = await visiblePost(supabase, postId);
  if (!on) {
    await supabase.from("mahdi_post_reactions").delete().eq("post_id", postId).eq("user_id", me.id).eq("kind", "ahsant");
    return;
  }
  const { error } = await supabase.from("mahdi_post_reactions").insert({ post_id: postId, user_id: me.id, kind: "ahsant" });
  if (error) {
    if (error.code === "23505") return;
    if (error.code === "23514") throw new UserError(S().notReady, 503);
    throw error;
  }
  if (post.user_id !== me.id) await notify([post.user_id], { kind: "ahsant", title: S().notify.ahsant(me.displayName), url: `/mahdi/p/${postId}` });
}

export async function commentsOf(supabase: SupabaseClient, me: string, postId: string): Promise<CommentView[]> {
  const post = await visiblePost(supabase, postId);
  const { data, error } = await supabase.from("mahdi_post_comments").select("id, user_id, body, created_at").eq("post_id", postId).order("created_at").limit(300);
  if (error) {
    if (notMigrated(error)) return [];
    throw error;
  }
  const users = await usersById((data ?? []).map((c) => c.user_id as string));
  return (data ?? []).map((c) => ({
    id: c.id as string,
    mine: c.user_id === me,
    canDelete: c.user_id === me || post.user_id === me,
    author: users.get(c.user_id as string) ?? { id: c.user_id as string, username: null, displayName: "", avatarUrl: null, frame: "" },
    body: c.body as string,
    createdAt: c.created_at as string,
  }));
}

export async function addComment(supabase: SupabaseClient, me: SocialUser, postId: string, body: string) {
  const post = await visiblePost(supabase, postId);
  const { error } = await supabase.from("mahdi_post_comments").insert({ post_id: postId, user_id: me.id, body });
  if (error) {
    if (notMigrated(error)) throw new UserError(S().notReady, 503);
    throw error;
  }
  if (post.user_id !== me.id) await notify([post.user_id], { kind: "comment", title: S().notify.comment(me.displayName), body, url: `/mahdi/p/${postId}` });
}

/** Counts a view once per person (never my own posts), for posts I may see. */
export async function recordViews(supabase: SupabaseClient, me: string, ids: string[]) {
  if (!ids.length) return;
  const { data } = await supabase.from("mahdi_posts").select("id, user_id").in("id", ids);
  const rows = (data ?? []).filter((p) => p.user_id !== me).map((p) => ({ post_id: p.id, user_id: me }));
  if (rows.length) await db().from("mahdi_post_views").upsert(rows, { onConflict: "post_id,user_id", ignoreDuplicates: true });
}

/** A report on a post or a story: reaches the owner at once; three hide it until the owner reviews it. */
export async function report(supabase: SupabaseClient, me: string, target: { post?: string; story?: string }, category: ReportCategory, reason: string) {
  const N = S().notify;
  const label = S().report.categories[category];
  if (target.post) {
    const post = await visiblePost(supabase, target.post);
    // A plain insert: "ignore if already there" needs a read permission reporters do not have (one report per person)
    let { error } = await supabase.from("mahdi_post_reports").insert({ post_id: post.id, user_id: me, reason, category });
    if (error && notMigrated(error)) ({ error } = await supabase.from("mahdi_post_reports").insert({ post_id: post.id, user_id: me, reason }));
    if (error?.code === "23505") return;
    if (error) throw error;
    const { count } = await db().from("mahdi_post_reports").select("user_id", { count: "exact", head: true }).eq("post_id", post.id);
    if ((count ?? 0) >= AUTO_HIDE_REPORTS) await db().from("mahdi_posts").update({ hidden_at: new Date().toISOString(), hidden_reason: N.autoHidden }).eq("id", post.id).is("hidden_at", null);
    const who = (await usersById([post.user_id])).get(post.user_id)?.displayName ?? "";
    await notify(await ownerIds(), { kind: "report", title: N.report(label), body: N.reportBody(who, (post.caption || String(post.payload?.text ?? post.payload?.title ?? "")).slice(0, 120)), url: "/admin/mahdi" });
    return;
  }
  const { data: story } = await supabase.from("mahdi_stories").select("id, user_id").eq("id", target.story!).maybeSingle();
  if (!story) throw new UserError(t.errors.notFound, 404);
  await db().from("mahdi_story_reports").upsert({ story_id: story.id, user_id: me, category, reason }, { ignoreDuplicates: true });
  const { count } = await db().from("mahdi_story_reports").select("user_id", { count: "exact", head: true }).eq("story_id", story.id);
  if ((count ?? 0) >= AUTO_HIDE_REPORTS) await db().from("mahdi_stories").update({ hidden_at: new Date().toISOString(), hidden_reason: N.autoHidden }).eq("id", story.id).is("hidden_at", null);
  const who = (await usersById([story.user_id as string])).get(story.user_id as string)?.displayName ?? "";
  await notify(await ownerIds(), { kind: "report", title: N.report(label), body: N.storyReportBody(who), url: "/admin/mahdi" });
}

/** Deletes a post with its file (its author, or the owner). */
export async function deletePost(postId: string, byUser?: string) {
  let q = db().from("mahdi_posts").delete().eq("id", postId);
  if (byUser) q = q.eq("user_id", byUser);
  const { data } = await q.select("*");
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
  await removeMedia([(data[0] as PostRow).media_path]);
}
