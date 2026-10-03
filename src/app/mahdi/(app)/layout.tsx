import { redirect } from "next/navigation";
import AppShell from "@/components/mahdi/AppShell";
import MahdiProvider from "@/components/mahdi/Provider";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";

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

  return (
    <MahdiProvider initial={snapshot}>
      <AppShell>{children}</AppShell>
    </MahdiProvider>
  );
}
