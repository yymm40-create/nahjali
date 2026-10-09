import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { DESIGNER } from "@config/designer";
import DesignerAdmin from "./DesignerAdmin";

export const metadata = { title: "المصمم الذكي | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: «كاظم»'s template, the style library, and the tests. */
export default async function DesignerAdminPage() {
  const user = await requireUser("/admin/designer");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">🎨 {DESIGNER.name}</h1>
        <Link href={DESIGNER.base} className="chip">افتح القسم ↗</Link>
      </div>
      <DesignerAdmin />
    </div>
  );
}
