// Moyasar (moyasar.com): card and mada for «اشحن رصيدك», on Moyasar's own hosted invoice page. Server only; the key never reaches the browser.
//   MOYASAR_SECRET_KEY — from the Moyasar dashboard (sk_test_… for the sandbox, sk_live_… after approval); the test or live mode
//   follows the key itself, there is one address for both.
// Flow: POST /v1/invoices (the amount in halalas) → the buyer pays on the invoice's `url` → back to /api/credits/moyasar/return,
// and Moyasar POSTs the invoice to /api/credits/moyasar/webhook when it is paid; either way the invoice is READ from Moyasar
// (never trusted from the URL or the body) before any balance is added.

const BASE = "https://api.moyasar.com/v1";
const secret = () => process.env.MOYASAR_SECRET_KEY?.trim() ?? "";

/** Is the key set? (the card button goes through Moyasar only then) */
export const moyasarEnabled = () => !!secret();

export class MoyasarError extends Error {}

async function call<T>(path: string, method: "GET" | "POST", body?: unknown): Promise<T> {
  const key = secret();
  if (!key) throw new MoyasarError("moyasar is not set up");
  const res = await fetch(`${BASE}${path}`, {
    method,
    // Basic auth: the secret key as the user name, no password
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` },
    body: body === undefined ? undefined : JSON.stringify(body),
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
    throw new MoyasarError(`moyasar ${path} ${res.status} ${msg}`);
  }
  return json as T;
}

export interface InvoiceInput {
  /** in riyals; sent in halalas */
  amount: number;
  description: string;
  /** where Moyasar POSTs the paid invoice (a notification, not a redirect) */
  callbackUrl: string;
  /** where the buyer lands after paying */
  successUrl: string;
  /** the page's back button */
  backUrl: string;
}

/** Riyals to halalas (Moyasar takes whole halalas, at least 100). */
export const halalas = (sar: number) => Math.round(sar * 100);

/** The payment page for one order: Moyasar's invoice id and its address. */
export async function createInvoice(i: InvoiceInput): Promise<{ id: string; url: string }> {
  const r = await call<{ id?: string; url?: string }>("/invoices", "POST", {
    amount: halalas(i.amount),
    currency: "SAR",
    description: i.description,
    callback_url: i.callbackUrl,
    success_url: i.successUrl,
    back_url: i.backUrl,
    // an unpaid page should not stay payable for ever
    expired_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });
  if (!r?.id || !r.url) throw new MoyasarError("moyasar gave no payment page");
  return { id: r.id, url: r.url };
}

export interface Invoice {
  id: string;
  /** in halalas */
  amount: number;
  currency: string;
  status: string;
}

/** The invoice as Moyasar holds it (what is true, not what the URL says). */
export async function getInvoice(id: string): Promise<Invoice> {
  const r = await call<{ id?: unknown; amount?: unknown; currency?: unknown; status?: unknown }>(`/invoices/${encodeURIComponent(id)}`, "GET");
  return { id: String(r?.id ?? ""), amount: Number(r?.amount ?? NaN), currency: String(r?.currency ?? ""), status: String(r?.status ?? "") };
}

/** Is this invoice really paid: the one we made for this order, in riyals, for this price? */
export const invoicePaid = (inv: Invoice, invoiceId: string, priceSar: number) => inv.status === "paid" && inv.id === invoiceId && inv.currency === "SAR" && inv.amount === halalas(priceSar);
