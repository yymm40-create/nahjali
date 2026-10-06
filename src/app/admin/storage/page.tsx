import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { legacyOn } from "@/lib/storage";
import CopyFiles from "./CopyFiles";

export const metadata = { title: "نقل الملفات إلى R2 | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the one-time copy of the files saved in Supabase before the move to Cloudflare R2. */
export default async function StoragePage() {
  const user = await requireUser("/admin/storage");
  if (!isAdmin(user.email)) notFound();
  const pending = await legacyOn().catch(() => null);

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <h1 className="text-2xl font-extrabold">نقل الملفات إلى Cloudflare R2</h1>
      {pending === null ? (
        <p className="card p-4 font-bold text-red-700">ما قدرنا نوصل لـ R2. تأكد من مفاتيح R2 في Vercel.</p>
      ) : pending ? (
        <CopyFiles />
      ) : (
        <p className="card p-4 font-bold">✅ كل الملفات صارت في R2، وسوبابيس ما يُستخدم للملفات.</p>
      )}
    </div>
  );
}
