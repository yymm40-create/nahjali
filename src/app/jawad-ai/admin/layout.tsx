import { notFound } from "next/navigation";
import AdminNav from "@/components/jawad/admin/AdminNav";
import { requireJawadUser } from "@/lib/jawad/server/access";

export const metadata = { title: "إدارة JAWAD AI" };
export const dynamic = "force-dynamic";

/** The owner's JAWAD AI settings (real permission check on every page and API call; 404 for everyone else). */
export default async function JawadAdminLayout({ children }: { children: React.ReactNode }) {
  const { owner } = await requireJawadUser("/jawad-ai/admin");
  if (!owner) notFound();
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
