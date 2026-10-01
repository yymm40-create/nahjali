import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getTemplate } from "@/lib/templates";
import { STATUS_LABELS, stepPath, type Order } from "@/lib/types";

export default async function MyBookletsPage() {
  await requireUser("/my-booklets");
  // Read through RLS: the user only ever sees their own orders
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
  const orders = (data ?? []) as Order[];
  const names = Object.fromEntries(
    await Promise.all([...new Set(orders.map((o) => o.template_id))].map(async (id) => [id, (await getTemplate(id))?.name ?? id])),
  );

  return (
    <div className="space-y-5">
      <h1 className="display text-4xl">كتيباتي</h1>
      {orders.length === 0 && (
        <div className="card space-y-4 p-6 text-center">
          <p className="font-bold">ما عندك كتيبات للحين.</p>
          <Link href="/new" className="btn btn-primary">سوّ أول كتيب</Link>
        </div>
      )}
      {orders.map((o) => (
        <Link key={o.id} href={stepPath(o)} className="card flex items-center justify-between gap-3 p-4">
          <div>
            <h2 className="text-lg font-extrabold">{names[o.template_id]}</h2>
            <p className="text-sm font-bold text-ink/60">{new Date(o.created_at).toLocaleDateString("ar-SA")}</p>
          </div>
          <span className={`chip ${o.status === "ready" ? "bg-lime text-ink" : o.status === "failed" ? "bg-bubble" : ""}`}>
            {STATUS_LABELS[o.status]}
          </span>
        </Link>
      ))}
      {orders.length > 0 && (
        <Link href="/new" className="btn btn-sun w-full">كتيب جديد</Link>
      )}
    </div>
  );
}
