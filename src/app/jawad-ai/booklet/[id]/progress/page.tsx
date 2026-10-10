import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { bookletStep } from "@/lib/tables-booklet/server";
import ProgressRunner from "@/app/order/[id]/progress/ProgressRunner";
import { TB } from "@config/tables-booklet";

export const dynamic = "force-dynamic";

export default async function BookletProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await requireOrder(id, `${TB.base}/${id}/progress`);
  if (!["generating_poses", "composing", "failed"].includes(order.status) || bookletStep(order) === `${TB.base}/${id}`) redirect(bookletStep(order));
  return <ProgressRunner orderId={order.id} base={`${TB.base}/${order.id}`} listHref={TB.base} />;
}
