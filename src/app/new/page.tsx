import { redirect } from "next/navigation";
import { requireOrder, requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { listTemplates } from "@/lib/templates";
import { stepPath } from "@/lib/types";
import { DEFAULT_QUALITY, DEV_PAYMENT_ENABLED, FREE_TRIAL, dailyTrialLimit, hasUnlimitedTrials, QUALITY_TIERS } from "@config/pricing";
import { DEFAULT_STYLE, STYLES } from "@config/styles";
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
  if (FREE_TRIAL && !hasUnlimitedTrials(user.email)) {
    // Daily limit: count from midnight in Riyadh (UTC+3)
    const riyadh = new Date(new Date().getTime() + 3 * 3600_000);
    const dayStart = new Date(Date.UTC(riyadh.getUTCFullYear(), riyadh.getUTCMonth(), riyadh.getUTCDate()) - 3 * 3600_000);
    const { count } = await createAdminClient()
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_trial", true)
      .gte("created_at", dayStart.toISOString());
    trialsLeft = Math.max(0, dailyTrialLimit(user) - (count ?? 0));
  }

  const templates = await listTemplates();
  const tiers = Object.entries(QUALITY_TIERS).map(([key, t]) => ({ key, ...t }));
  const styles = Object.entries(STYLES).map(([key, s]) => ({ key, label: s.label, description: s.description }));
  const devPayment = DEV_PAYMENT_ENABLED && process.env.NODE_ENV !== "production";

  return (
    <NewOrder
      templateId={templates[0]?.id ?? ""}
      tiers={tiers}
      styles={styles}
      defaultQuality={DEFAULT_QUALITY}
      defaultStyle={DEFAULT_STYLE}
      freeTrial={FREE_TRIAL}
      trialsLeft={trialsLeft}
      pendingOrder={pendingOrder}
      devPayment={devPayment}
    />
  );
}
