import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { CONTENT } from "@config/content";
import ContentAdmin from "./ContentAdmin";

export const metadata = { title: "صانع المحتوى | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: «محمد باقر»'s template, the example bank, and the tests. */
export default async function ContentAdminPage() {
  const user = await requireUser("/admin/content");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">✍️ {CONTENT.name}</h1>
        <Link href={CONTENT.base} className="chip">افتح القسم ↗</Link>
      </div>
      <ContentAdmin />
    </div>
  );
}
