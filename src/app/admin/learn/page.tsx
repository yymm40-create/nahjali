import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import LearnAdmin from "./LearnAdmin";

export const metadata = { title: "مكان الدورات | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: courses › days › videos (protected), who may watch, and what was flagged. */
export default async function LearnAdminPage() {
  const user = await requireUser("/admin/learn");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <h1 className="text-2xl font-extrabold">📚 مكان الدورات</h1>
      <LearnAdmin />
    </div>
  );
}
