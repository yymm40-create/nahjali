// SERVER ONLY. Keeps the public copy of a user (name, picture, frame) in line with their choices.
import { createAdminClient } from "@/lib/supabase/admin";
import { avatarUrl } from "./rows";

/** Writes or removes the user's public profile, following their privacy settings. Removing it also removes their posts. */
export async function syncPublicProfile(userId: string) {
  const db = createAdminClient();
  const [{ data: privacy }, { data: profile }, { data: handle }] = await Promise.all([
    db.from("mahdi_privacy").select("community, show_avatar").eq("user_id", userId).maybeSingle(),
    db.from("mahdi_profiles").select("display_name, avatar_path, frame").eq("user_id", userId).maybeSingle(),
    db.from("site_usernames").select("username").eq("user_id", userId).maybeSingle(),
  ]);
  if (!privacy?.community || !profile) {
    await db.from("mahdi_public_profiles").delete().eq("user_id", userId);
    return;
  }
  const row = {
    user_id: userId,
    display_name: profile.display_name,
    avatar_url: privacy.show_avatar ? avatarUrl(profile.avatar_path) : null,
    frame: profile.frame ?? "",
    updated_at: new Date().toISOString(),
  };
  // The username (for the person's page) needs migration 0020; without it the copy is kept as before
  let { error } = await db.from("mahdi_public_profiles").upsert({ ...row, username: handle?.username ?? null });
  if (error?.code === "PGRST204" || error?.code === "42703") ({ error } = await db.from("mahdi_public_profiles").upsert(row));
  if (error) throw error;
}
