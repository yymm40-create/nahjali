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
    <div className="jw-admin-shell mx-auto max-w-[1500px] space-y-5 px-4 pb-16 pt-5">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-jw-accent">Control Center</span>
            <h1 className="text-2xl font-bold">مركز إدارة الجواد والموقع</h1>
            <p className="text-sm text-jw-muted">لوحة واحدة لكل الفروع والمستخدمين والأسعار والتشغيل.</p>
          </div>
        </div>
        <AdminNav />
      </header>
      {children}
    </div>
  );
}
