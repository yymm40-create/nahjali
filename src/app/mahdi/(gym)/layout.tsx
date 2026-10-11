import { redirect } from "next/navigation";
import GymShell from "@/components/mahdi/health/GymShell";
import HealthProvider from "@/components/mahdi/health/HealthProvider";
import MahdiProvider from "@/components/mahdi/Provider";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { loadSnapshot } from "@/lib/mahdi/server/snapshot";

export const dynamic = "force-dynamic";

/**
 * «الصحة العلوية» as an app of its own: its own look, header and tabs (no «لأجل المهدي» menus), but the same account
 * and the same data — the habits made from the plan and everything logged here are «لأجل المهدي»'s own.
 */
export default async function GymLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await getMahdiSession();
  if (!user) redirect("/mahdi/start");
  if (!profile) redirect("/mahdi/welcome");
  const snapshot = await loadSnapshot(supabase, profile);
  return (
    <MahdiProvider initial={snapshot}>
      <HealthProvider>
        <GymShell>{children}</GymShell>
      </HealthProvider>
    </MahdiProvider>
  );
}
