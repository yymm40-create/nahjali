import { requireJawadOwnerPage } from "@/lib/jawad/server/access";
import { loadSettings } from "@/lib/khateeb/gate";
import KhateebAdmin from "./KhateebAdmin";

export const dynamic = "force-dynamic";
export const metadata = { title: "الخطيب الذكي" };

/** The owner's «الخطيب الذكي»: the secret link, the password, the Sheikh's method and the poems. */
export default async function KhateebAdminPage() {
  await requireJawadOwnerPage("/jawad-ai/admin/khateeb");
  return <KhateebAdmin initial={await loadSettings()} />;
}
