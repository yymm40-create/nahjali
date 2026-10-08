import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { ISLAMIC } from "@config/islamic";
import IslamicAdmin from "./IslamicAdmin";

export const metadata = { title: "الذكاء الإسلامي | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the sources of «الذكاء الإسلامي», reading them, the method, and the answers given. */
export default async function IslamicAdminPage() {
  const user = await requireUser("/admin/islamic");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">🕌 {ISLAMIC.name}</h1>
        <Link href={ISLAMIC.base} className="chip">افتح القسم ↗</Link>
      </div>
      <IslamicAdmin />
    </div>
  );
}
