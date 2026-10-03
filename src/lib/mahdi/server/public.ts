// SERVER ONLY. Keeps the public copy of a user (name, picture, frame) in line with their choices.
import { createAdminClient } from "@/lib/supabase/admin";
import { avatarUrl } from "./rows";

/** Writes or removes the user's public profile, following their privacy settings. Removing it also removes their posts. */
export async function syncPublicProfile(userId: string) {
  const db = createAdminClient();
  const [{ data: privacy }, { data: profile }] = await Promise.all([
    db.from("mahdi_privacy").select("community, show_avatar").eq("user_id", userId).maybeSingle(),
    db.from("mahdi_profiles").select("display_name, avatar_path, frame").eq("user_id", userId).maybeSingle(),
  ]);
  if (!privacy?.community || !profile) {
    await db.from("mahdi_public_profiles").delete().eq("user_id", userId);
    return;
  }
  const { error } = await db.from("mahdi_public_profiles").upsert({
    user_id: userId,
    display_name: profile.display_name,
    avatar_url: privacy.show_avatar ? avatarUrl(profile.avatar_path) : null,
    frame: profile.frame ?? "",
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
