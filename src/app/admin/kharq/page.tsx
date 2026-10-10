import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { KHARQ } from "@config/kharq";
import KharqAdmin from "./KharqAdmin";

export const metadata = { title: `${KHARQ.name} | لوحة التحكم` };
export const dynamic = "force-dynamic";

/** Owner only: «محمد الخارق»'s template and who may open the branch. */
export default async function KharqAdminPage() {
  const user = await requireUser("/admin/kharq");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">🧠 {KHARQ.name}</h1>
        <Link href={KHARQ.base} className="chip">افتح المحادثة ↗</Link>
      </div>
      <KharqAdmin />
    </div>
  );
}
