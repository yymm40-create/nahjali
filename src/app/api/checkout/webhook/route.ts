import { NextResponse } from "next/server";
import { settleFormPayment } from "@/lib/credits/checkout-settle";

export const dynamic = "force-dynamic";

/**
 * Moyasar's webhook (set in its dashboard: Webhooks → this address, the «payment_paid» event), for a buyer who paid and closed the
 * page before coming back. Only the payment id in the body is used; the payment itself is READ from Moyasar and settled by its
 * metadata, so a forged call can do nothing.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { id?: unknown; data?: { id?: unknown } };
  const id = typeof b.data?.id === "string" ? b.data.id : typeof b.id === "string" ? b.id : "";
  const r = await settleFormPayment(id).catch((e) => {
    console.error("checkout webhook", id, e);
    return { paid: false };
  });
  return NextResponse.json({ ok: true, paid: r.paid });
}
