import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { stepPath } from "@/lib/types";
import UploadForm from "./UploadForm";

export default async function UploadPage({ params }: PageProps<"/order/[id]/upload">) {
  const { id } = await params;
  const order = await requireOrder(id, `/order/${id}/upload`);
  if (!["paid", "awaiting_approval"].includes(order.status)) redirect(stepPath(order));

  return <UploadForm orderId={order.id} attemptsLeft={order.attempts_allowed - order.attempts_used} />;
}
