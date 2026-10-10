import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import ShareAdmin from "./ShareAdmin";

export const metadata = { title: "انشرنا واربح | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the Instagram-share offer — on/off, the reward, and the claims to confirm. */
export default async function ShareAdminPage() {
  const user = await requireUser("/admin/share");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <h1 className="text-2xl font-extrabold">🎁 انشرنا واربح</h1>
      <ShareAdmin />
    </div>
  );
}
