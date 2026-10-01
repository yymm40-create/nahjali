import { redirect } from "next/navigation";
import { requireOrder } from "@/lib/auth";
import { stepPath } from "@/lib/types";
import ProgressRunner from "./ProgressRunner";

export default async function ProgressPage({ params }: PageProps<"/order/[id]/progress">) {
  const { id } = await params;
  const order = await requireOrder(id, `/order/${id}/progress`);
  if (!["generating_poses", "composing", "failed"].includes(order.status)) redirect(stepPath(order));

  return <ProgressRunner orderId={order.id} />;
}
