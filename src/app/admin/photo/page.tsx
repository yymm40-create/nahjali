import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { PHOTO } from "@config/photo";
import PhotoAdmin from "./PhotoAdmin";

export const metadata = { title: "زهراء فوتو ماستر | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: «زهراء»'s template and who may open the editor. */
export default async function PhotoAdminPage() {
  const user = await requireUser("/admin/photo");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">📸 {PHOTO.name}</h1>
        <Link href={PHOTO.base} className="chip">افتح البرنامج ↗</Link>
      </div>
      <PhotoAdmin />
    </div>
  );
}
