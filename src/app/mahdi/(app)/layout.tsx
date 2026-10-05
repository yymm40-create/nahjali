import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/mahdi/AppShell";
import MahdiProvider from "@/components/mahdi/Provider";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";
import { ensureUsername } from "@/lib/username";

export const dynamic = "force-dynamic";

/**
 * The signed-in app. The user's data is loaded once here and kept on the device (MahdiProvider), so moving
 * between screens is instant and taps update the screen before the server answers.
 */
export default async function MahdiAppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getMahdiSession();
  if (!user) redirect("/mahdi/start");
  if (!profile) redirect("/mahdi/welcome");
  const snapshot = await loadSnapshot(supabase, profile);
  // Every account has a unique username: the name already used here becomes it, unless someone has it
  if (!snapshot.username) {
    const name = await ensureUsername(supabase, user, [profile.displayName]).catch(() => null);
    if (!name) redirect("/mahdi/username");
    snapshot.username = name;
  }

  // Arrived from someone's invitation link and now in the app: to that person's page, once
  if ((await cookies()).has("mahdi_invite")) redirect("/api/mahdi/invite?done=1");

  // A family member's account (entered by the parent) says so on every screen, with the way back
  const { data: family } = await supabase.from("mahdi_family").select("parent_id").eq("member_id", user.id).maybeSingle();

  return (
    <MahdiProvider initial={snapshot}>
      <AppShell familyMember={Boolean(family)}>{children}</AppShell>
    </MahdiProvider>
  );
}
