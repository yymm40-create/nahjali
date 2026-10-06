import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import AdminNav from "./AdminNav";

/** The owner's dashboard: one menu for every branch beside each page (only the owner; anyone else gets 404). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/admin");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
