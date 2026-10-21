// SERVER ONLY. Meta Conversions API: the Purchase the owner confirms, sent with the SAME event_id as the browser's
// «✅ تم التحويل» event (the order id), so Meta counts the two once. Optional: nothing is sent without META_CAPI_TOKEN and
// NEXT_PUBLIC_META_PIXEL_ID; callers fire-and-forget (the confirm never waits for it).

import { createHash } from "node:crypto";

const sha256 = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

export const metaCapiReady = () => Boolean(process.env.META_CAPI_TOKEN && process.env.NEXT_PUBLIC_META_PIXEL_ID);

export interface PurchaseEvent {
  /** the order id: the browser sent its Purchase with this same event_id */
  orderId: string;
  email?: string | null;
  valueSar: number;
  /** the package's name */
  contentName?: string | null;
  /** Meta's browser cookies at the time of the order (kept in the order's source) */
  fbp?: string | null;
  fbc?: string | null;
  /** the buyer's address and browser at the time of the order (never the owner's) */
  ip?: string | null;
  ua?: string | null;
  /** when the buyer pressed «تم التحويل» (the browser event's time); now when unknown */
  at?: string | null;
  sourceUrl?: string;
}

/** Sends the Purchase; true when Meta accepted it, false when the API is not set up. Throws on a refusal. */
export async function sendPurchase(o: PurchaseEvent): Promise<boolean> {
  const token = process.env.META_CAPI_TOKEN;
  const pixel = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  if (!token || !pixel) return false;
  const now = Math.floor(Date.now() / 1000);
  const when = o.at ? Math.floor(new Date(o.at).getTime() / 1000) : NaN;
  // Meta takes an event up to 7 days old, never one in the future
  const event_time = Number.isFinite(when) ? Math.min(now, Math.max(when, now - 6 * 86400)) : now;
  const user_data: Record<string, unknown> = {};
  if (o.email) user_data.em = [sha256(o.email)];
  if (o.fbp) user_data.fbp = o.fbp;
  if (o.fbc) user_data.fbc = o.fbc;
  if (o.ip) user_data.client_ip_address = o.ip;
  if (o.ua) user_data.client_user_agent = o.ua;
  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time,
        event_id: o.orderId,
        action_source: "website",
        ...(o.sourceUrl ? { event_source_url: o.sourceUrl } : {}),
        user_data,
        custom_data: { value: o.valueSar, currency: "SAR", ...(o.contentName ? { content_name: o.contentName } : {}) },
      },
    ],
    access_token: token,
  };
  // Events Manager → Test events: with the code set, the server events show there while the setup is checked
  if (process.env.META_CAPI_TEST_CODE) body.test_event_code = process.env.META_CAPI_TEST_CODE;
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixel)}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Meta CAPI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return true;
}
