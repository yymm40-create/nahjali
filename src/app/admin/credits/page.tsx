import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import { CREDITS } from "@config/credits";
import CreditsAdmin from "./CreditsAdmin";

export const metadata = { title: "باقات الرصيد | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: the packages of balance, the WhatsApp number for «طال الوقت؟», and the top-up orders to confirm. */
export default async function CreditsAdminPage() {
  const user = await requireUser("/admin/credits");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">💳 باقات الرصيد والشحن</h1>
        <Link href={CREDITS.base} className="chip" target="_blank">افتح صفحة الشحن ↗</Link>
      </div>
      <CreditsAdmin />
    </div>
  );
}
