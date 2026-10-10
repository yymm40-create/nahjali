import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { bookletStep } from "@/lib/tables-booklet/server";
import UploadForm from "@/app/order/[id]/upload/UploadForm";
import { TB } from "@config/tables-booklet";

export const dynamic = "force-dynamic";

export default async function BookletUploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await requireOrder(id, `${TB.base}/${id}/upload`);
  if (!["paid", "awaiting_approval"].includes(order.status) || bookletStep(order) === `${TB.base}/${id}`) redirect(bookletStep(order));
  return <UploadForm orderId={order.id} attemptsLeft={order.attempts_allowed - order.attempts_used} base={`${TB.base}/${order.id}`} />;
}
