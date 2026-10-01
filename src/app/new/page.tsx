import { redirect } from "next/navigation";
import { requireOrder, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/lib/templates";
import { stepPath } from "@/lib/types";
import { DEFAULT_QUALITY, DEV_PAYMENT_ENABLED, FREE_TRIAL, FREE_TRIAL_MAX_ORDERS, QUALITY_TIERS } from "@config/pricing";
import NewOrder from "./NewOrder";

export default async function NewPage({ searchParams }: PageProps<"/new">) {
  const user = await requireUser("/new");
  const { order: orderId } = await searchParams;

  let pendingOrder: { id: string; amount_halalas: number } | null = null;
  if (typeof orderId === "string") {
    const order = await requireOrder(orderId, "/new");
    if (order.status !== "pending_payment") redirect(stepPath(order));
    pendingOrder = { id: order.id, amount_halalas: order.amount_halalas };
  }

  let trialsLeft: number | null = null;
  if (FREE_TRIAL) {
    const { count } = await createAdminClient()
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_trial", true);
    trialsLeft = Math.max(0, FREE_TRIAL_MAX_ORDERS - (count ?? 0));
  }

  const templates = (await listTemplates()).map((t) => ({ id: t.id, name: t.name, pages: t.pages.length }));
  const tiers = Object.entries(QUALITY_TIERS).map(([key, t]) => ({ key, ...t }));
  const devPayment = DEV_PAYMENT_ENABLED && process.env.NODE_ENV !== "production";

  return (
    <NewOrder
      templates={templates}
      tiers={tiers}
      defaultQuality={DEFAULT_QUALITY}
      freeTrial={FREE_TRIAL}
      trialsLeft={trialsLeft}
      pendingOrder={pendingOrder}
      devPayment={devPayment}
    />
  );
}
