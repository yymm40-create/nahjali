import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { bookletStep, specOf } from "@/lib/tables-booklet/server";
import { TB } from "@config/tables-booklet";
import ComposeNow from "./ComposeNow";

export const dynamic = "force-dynamic";

/** A booklet: sent on to its step; a designed one without a picture is drawn here at once. */
export default async function BookletOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await requireOrder(id, `${TB.base}/${id}`);
  const step = bookletStep(order);
  if (step !== `${TB.base}/${id}`) redirect(step);
  return <ComposeNow orderId={order.id} title={specOf(order)?.design?.title ?? TB.name} />;
}
