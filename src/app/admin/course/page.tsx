import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { COURSE } from "@config/course";
import { isAdmin } from "@config/site";
import CourseAdmin from "./CourseAdmin";

export const metadata = { title: "دورة الجواد | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the course's clock and prices, its page's words, the bank data, Telegram, and the orders to confirm. */
export default async function CourseAdminPage() {
  const user = await requireUser("/admin/course");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">🎓 {COURSE.name}</h1>
        <Link href={COURSE.base} className="chip" target="_blank">افتح صفحة البيع ↗</Link>
      </div>
      <CourseAdmin />
    </div>
  );
}
