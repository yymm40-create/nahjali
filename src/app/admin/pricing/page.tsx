import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import PricingCalculator from "./PricingCalculator";

export const metadata = { title: "حاسبة الأسعار والأرباح | لوحة التحكم" };
export const dynamic = "force-dynamic";

/** Owner only: costs (estimated and real), and the customer price and profit for any margin. */
export default async function PricingPage() {
  const user = await requireUser("/admin/pricing");
  if (!isAdmin(user.email)) notFound();

  // Real average cost of each paid operation so far (settled = finished and billed)
  const { data } = await createAdminClient().from("film_usage").select("operation,actual_cost_usd,estimated_cost_usd,units").eq("state", "settled");
  const real: Record<string, { avg: number; count: number }> = {};
  for (const r of data ?? []) {
    const cost = Number(r.actual_cost_usd ?? r.estimated_cost_usd ?? 0);
    const e = (real[r.operation] ??= { avg: 0, count: 0 });
    e.avg = (e.avg * e.count + cost) / (e.count + 1);
    e.count++;
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link href="/admin" className="text-sm font-bold text-muted">→ لوحة التحكم</Link>
        <h1 className="display text-4xl">🧮 حاسبة الأسعار والأرباح</h1>
        <p className="text-sm font-bold text-muted">كل الأرقام بالريال (الدولار = ٣٫٧٥ ريال). التكاليف تقديرية، وجنبها المتوسط الفعلي من استخدام الموقع لما يتوفر.</p>
      </header>
      <PricingCalculator real={real} />
    </div>
  );
}
