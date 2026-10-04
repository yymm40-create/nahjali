import AdminNav from "@/components/jawad/admin/AdminNav";
import { jawadSession, requireJawadOwnerPage } from "@/lib/jawad/server/access";

// Titled for the owner only: everyone else gets the plain 404 (not even the tab title tells it exists)
export async function generateMetadata() {
  return (await jawadSession()).owner ? { title: "إدارة JAWAD AI" } : { title: "الصفحة غير موجودة" };
}
export const dynamic = "force-dynamic";

/** The owner's JAWAD AI settings (real permission check on every page and API call; 404 for everyone else). */
export default async function JawadAdminLayout({ children }: { children: React.ReactNode }) {
  await requireJawadOwnerPage("/jawad-ai/admin");
  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 pb-16 pt-5">
      <header className="space-y-3">
        <h1 className="text-xl font-bold">إدارة <span dir="ltr">JAWAD AI</span></h1>
        <AdminNav />
      </header>
      {children}
    </div>
  );
}
