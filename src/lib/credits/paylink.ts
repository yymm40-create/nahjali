// Paylink (paylink.sa): card, mada, Apple Pay and STC Pay for «اشحن رصيدك». Server only; the keys never reach the browser.
//   PAYLINK_API_ID, PAYLINK_SECRET_KEY — from the Paylink dashboard (the test pair for the test account, the live pair after approval)
//   PAYLINK_BASE — optional: https://restpilot.paylink.sa for the test environment; default https://restapi.paylink.sa (live)
// Flow: auth → id_token (cached) → addInvoice (the order id as orderNumber) → the buyer pays on Paylink's page → back to
// /api/credits/paylink/return, where the invoice is READ from Paylink (never trusted from the URL) before any balance is added.

const BASE = () => (process.env.PAYLINK_BASE || "https://restapi.paylink.sa").replace(/\/+$/, "");
// the names the owner may have used in Vercel (names are case-sensitive): the documented one first
const ID_NAMES = ["PAYLINK_API_ID", "API_ID", "api_id", "PAYLINK_APP_ID"];
const SECRET_NAMES = ["PAYLINK_SECRET_KEY", "SECRET_KEY", "secret_key", "PAYLINK_SECRET"];
const pick = (names: string[]) => names.map((n) => process.env[n]?.trim()).find(Boolean) ?? "";
const keys = () => ({ apiId: pick(ID_NAMES), secretKey: pick(SECRET_NAMES) });

/** Are the keys set? (the card button shows only then) */
export const paylinkEnabled = () => {
  const k = keys();
  return !!(k.apiId && k.secretKey);
};

export class PaylinkError extends Error {}

let cached: { token: string; until: number } | null = null;

async function call<T>(path: string, init: { method: "GET" | "POST"; body?: unknown; token?: string }): Promise<T> {
  const res = await fetch(`${BASE()}${path}`, {
    method: init.method,
    headers: { accept: "application/json", "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}
  if (!res.ok) {
    const msg = json && typeof json === "object" ? JSON.stringify(json).slice(0, 300) : text.slice(0, 200);
    throw new PaylinkError(`paylink ${path} ${res.status} ${msg}`);
  }
  return json as T;
}

/** The bearer token (30 minutes; kept 25 in memory). */
async function token(force = false): Promise<string> {
  if (!force && cached && cached.until > Date.now()) return cached.token;
  const { apiId, secretKey } = keys();
  if (!apiId || !secretKey) throw new PaylinkError("paylink is not set up");
  const r = await call<{ id_token?: string }>("/api/auth", { method: "POST", body: { apiId, secretKey, persistToken: false } });
  if (!r?.id_token) throw new PaylinkError("paylink auth gave no token");
  cached = { token: r.id_token, until: Date.now() + 25 * 60_000 };
  return r.id_token;
}

/** A call with the token; once more with a fresh token when the cached one was refused. */
async function authed<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  try {
    return await call<T>(path, { method, body, token: await token() });
  } catch (e) {
    if (e instanceof PaylinkError && / 401 | 403 /.test(e.message)) return call<T>(path, { method, body, token: await token(true) });
    throw e;
  }
}

export interface InvoiceInput {
  orderNumber: string;
  amount: number;
  clientName: string;
  clientMobile: string;
  clientEmail?: string;
  title: string;
  callBackUrl: string;
  cancelUrl: string;
}

/** The payment page for one order: its address and Paylink's transaction number. */
export async function addInvoice(i: InvoiceInput): Promise<{ transactionNo: string; url: string }> {
  const r = await authed<{ transactionNo?: string; url?: string }>("/api/addInvoice", "POST", {
    orderNumber: i.orderNumber,
    amount: i.amount,
    callBackUrl: i.callBackUrl,
    cancelUrl: i.cancelUrl,
    clientName: i.clientName,
    clientMobile: i.clientMobile,
    ...(i.clientEmail ? { clientEmail: i.clientEmail } : {}),
    currency: "SAR",
    products: [{ title: i.title, price: i.amount, qty: 1 }],
  });
  if (!r?.transactionNo || !r.url) throw new PaylinkError("paylink gave no payment page");
  return { transactionNo: r.transactionNo, url: r.url };
}

export interface Invoice {
  orderNumber: string;
  amount: number;
  status: string;
}

/** The invoice as Paylink holds it (what is true, not what the URL says). */
export async function getInvoice(transactionNo: string): Promise<Invoice> {
  const r = await authed<{ orderNumber?: unknown; amount?: unknown; orderStatus?: unknown }>(`/api/getInvoice/${encodeURIComponent(transactionNo)}`, "GET");
  return { orderNumber: String(r?.orderNumber ?? ""), amount: Number(r?.amount ?? NaN), status: String(r?.orderStatus ?? "") };
}

/** Is this invoice really paid, for this order and this amount? */
export const invoicePaid = (inv: Invoice, orderId: string, priceSar: number) => /^paid$/i.test(inv.status) && inv.orderNumber === orderId && Math.abs(inv.amount - priceSar) < 0.005;
