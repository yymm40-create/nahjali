// SERVER ONLY. «القصص»: photos, videos (up to 30 seconds) and quotes that last 24 hours. Who may see them is the
// same rule as posts (RLS with public.mahdi_can_see); people I follow come first.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { t } from "../i18n";
import type { SocialUser, StoryGroup, StoryView } from "../social";
import { UserError } from "./api";
import { checkUploadedMedia, removeMedia, signMedia } from "./media";
import { followingIds, notMigrated, usersById } from "./social";
import { cleanLine, cleanText } from "./validate";

const db = () => createAdminClient();
const STYLES = ["gold", "night", "green", "rose"];

interface StoryRow {
  id: string;
  user_id: string;
  kind: "photo" | "video" | "quote";
  media_path: string | null;
  media_ms: number | null;
  width: number | null;
  height: number | null;
  text: string;
  style: string;
  views: number;
  created_at: string;
  expires_at: string;
}

/** The live stories I may see, one group per person: mine first, then people I follow, then the rest. */
export async function storyGroups(supabase: SupabaseClient, me: string): Promise<StoryGroup[]> {
  const { data, error } = await supabase.from("mahdi_stories").select("*").is("hidden_at", null).gt("expires_at", new Date().toISOString()).order("created_at").limit(500);
  if (error) {
    if (notMigrated(error)) return [];
    throw error;
  }
  const rows = (data ?? []) as StoryRow[];
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [users, links, seen, follows] = await Promise.all([
    usersById(rows.map((r) => r.user_id)),
    signMedia(rows.map((r) => r.media_path), 3 * 3600),
    db().from("mahdi_story_views").select("story_id").eq("user_id", me).in("story_id", ids),
    followingIds(me),
  ]);
  const seenIds = new Set((seen.data ?? []).map((r) => r.story_id as string));
  const followed = new Set(follows ?? []);
  const groups = new Map<string, StoryGroup>();
  for (const r of rows) {
    const user: SocialUser = users.get(r.user_id) ?? { id: r.user_id, username: null, displayName: "", avatarUrl: null, frame: "" };
    const g = groups.get(r.user_id) ?? groups.set(r.user_id, { user, mine: r.user_id === me, stories: [], fresh: false }).get(r.user_id)!;
    const url = r.media_path ? links.get(r.media_path) : undefined;
    const view: StoryView = {
      id: r.id,
      kind: r.kind,
      media: url ? { kind: r.kind === "video" ? "video" : "image", url, width: r.width, height: r.height, ms: r.media_ms } : null,
      text: r.text,
      style: r.style,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      seen: r.user_id === me || seenIds.has(r.id),
      ...(r.user_id === me ? { views: r.views } : {}),
    };
    if (r.kind !== "quote" && !view.media) continue;
    g.stories.push(view);
    if (!view.seen) g.fresh = true;
  }
  const rank = (g: StoryGroup) => (g.mine ? 0 : followed.has(g.user.id) ? (g.fresh ? 1 : 3) : g.fresh ? 2 : 4);
  return [...groups.values()].filter((g) => g.stories.length).sort((a, b) => rank(a) - rank(b));
}

/** A new story (members of the community; up to 10 a day). */
export async function addStory(supabase: SupabaseClient, userId: string, body: Record<string, unknown>) {
  const kind = body.kind === "video" ? "video" : body.kind === "quote" ? "quote" : body.kind === "photo" ? "photo" : null;
  if (!kind) throw new UserError(t.errors.invalid, 400);
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count, error: e0 } = await supabase.from("mahdi_stories").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if (e0) throw notMigrated(e0) ? new UserError(t.social.notReady, 503) : e0;
  if ((count ?? 0) >= 10) throw new UserError(t.social.post.tooMany, 429);
  const text = kind === "quote" ? cleanText(body.text, 500) : cleanLine(body.text, 200);
  if (kind === "quote" && !text) throw new UserError(t.social.post.needQuote, 400);
  let row: Record<string, unknown> = { user_id: userId, kind, text, style: STYLES.includes(String(body.style)) ? String(body.style) : "gold" };
  if (kind !== "quote") {
    const m = await checkUploadedMedia(userId, body.media, kind === "video" ? "video" : "image");
    row = { ...row, media_path: m.path, media_ms: m.ms, width: m.width, height: m.height };
  }
  const { error } = await db().from("mahdi_stories").insert(row);
  if (error) throw error;
}

/** Counts my view of a story once (never my own). */
export async function viewStory(supabase: SupabaseClient, me: string, id: string) {
  const { data } = await supabase.from("mahdi_stories").select("id, user_id").eq("id", id).maybeSingle();
  if (data && data.user_id !== me) await db().from("mahdi_story_views").upsert({ story_id: id, user_id: me }, { onConflict: "story_id,user_id", ignoreDuplicates: true });
}

/** Who saw one of my stories. */
export async function storyViewers(me: string, id: string): Promise<SocialUser[]> {
  const { data: story } = await db().from("mahdi_stories").select("user_id").eq("id", id).maybeSingle();
  if (!story || story.user_id !== me) throw new UserError(t.errors.notFound, 404);
  const { data } = await db().from("mahdi_story_views").select("user_id, viewed_at").eq("story_id", id).order("viewed_at", { ascending: false }).limit(500);
  const users = await usersById((data ?? []).map((r) => r.user_id as string));
  return (data ?? []).flatMap((r) => (users.has(r.user_id as string) ? [users.get(r.user_id as string)!] : []));
}

/** Deletes a story with its file (its author, or the owner without `byUser`). */
export async function deleteStory(id: string, byUser?: string) {
  let q = db().from("mahdi_stories").delete().eq("id", id);
  if (byUser) q = q.eq("user_id", byUser);
  const { data } = await q.select("media_path");
  if (!data?.length) throw new UserError(t.errors.notFound, 404);
  await removeMedia([data[0].media_path as string | null]);
}
