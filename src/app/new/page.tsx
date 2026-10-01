import { redirect } from "next/navigation";
import { requireOrder, requireUser } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";
import { stepPath } from "@/lib/types";
import { DEV_PAYMENT_ENABLED } from "@config/pricing";
import NewOrder from "./NewOrder";

export default async function NewPage({ searchParams }: PageProps<"/new">) {
  await requireUser("/new");
  const { order: orderId } = await searchParams;

  let pendingOrder: { id: string; amount_halalas: number } | null = null;
  if (typeof orderId === "string") {
    const order = await requireOrder(orderId, "/new");
    if (order.status !== "pending_payment") redirect(stepPath(order));
    pendingOrder = { id: order.id, amount_halalas: order.amount_halalas };
  }

  const templates = (await listTemplates()).map((t) => ({ id: t.id, name: t.name, pages: t.pages.length }));
  const devPayment = DEV_PAYMENT_ENABLED && process.env.NODE_ENV !== "production";

  return <NewOrder templates={templates} pendingOrder={pendingOrder} devPayment={devPayment} />;
}
