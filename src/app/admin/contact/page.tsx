import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isAdmin } from "@config/site";
import Contact from "./Contact";

export const metadata = { title: "رقم الشخص | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: a person's phone (when they left one on an order), and one tap to open their WhatsApp. */
export default async function ContactPage() {
  const user = await requireUser("/jawad-ai/admin/contact");
  if (!isAdmin(user.email)) notFound();
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">📱 رقم الشخص</h1>
        <p className="text-sm font-bold text-muted">اكتب إيميل الشخص كامل، ويطلع رقمه لو كان ترك رقمًا في طلب على الموقع (الدورة أو شحن الرصيد)، وبضغطة يفتح لك واتسابه.</p>
      </header>
      <Contact />
    </div>
  );
}
