// «عرض الـ٢٥ ريال» (config/jawad/offer10.ts): the purchase through Moyasar and what is still free for one person. Server only.
// The purchase is kept in jawad_settings under «offer10:<user id>» (no new table): the invoices made for it, and `paidAt`
// once one of them is READ from Moyasar as paid. Free jobs carry `inputs.offer10 = true`; usage is counted from them.

import { UserError } from "@/lib/api";
import { createInvoice, getInvoice, halalas, invoicePaid, moyasarEnabled, type Payment } from "@/lib/credits/moyasar";
import { checkoutUrl, formEnabled, formPaymentPaid } from "@/lib/credits/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFFER10, OFFER10_GRANTS, offer10GrantFor, offer10Open, type Offer10Key } from "@config/jawad/offer10";

const db = () => createAdminClient();
const keyOf = (userId: string) => `offer10:${userId}`;

interface PassValue {
  invoices: string[];
  paidAt?: string;
  invoiceId?: string;
}

async function readPass(userId: string): Promise<PassValue> {
  const { data } = await db().from("jawad_settings").select("value").eq("key", keyOf(userId)).maybeSingle();
  const v = (data?.value ?? {}) as Partial<PassValue>;
  return { invoices: Array.isArray(v.invoices) ? v.invoices.map(String).slice(-10) : [], ...(typeof v.paidAt === "string" ? { paidAt: v.paidAt } : {}), ...(typeof v.invoiceId === "string" ? { invoiceId: v.invoiceId } : {}) };
}

async function writePass(userId: string, v: PassValue) {
  const { error } = await db().from("jawad_settings").upsert({ key: keyOf(userId), value: v, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) throw error;
}

/** When this person paid for the offer (null = not paid). */
export async function offer10PaidAt(userId: string): Promise<string | null> {
  return (await readPass(userId).catch(() => null))?.paidAt ?? null;
}

/** Starts the purchase: Moyasar's invoice page for 10 riyals, tied to this account. */
export async function startOffer10(user: { id: string }, origin: string): Promise<{ url: string }> {
  if (!moyasarEnabled()) throw new UserError("الدفع بالبطاقة غير متاح الحين، تواصل معنا.", 503);
  const pass = await readPass(user.id);
  if (pass.paidAt) throw new UserError("اشتركت في العرض من قبل، وهو شغّال في حسابك.", 409);
  if (!offer10Open()) throw new UserError("انتهى وقت العرض.", 410);
  const description = `عرض الجواد الذكي (${OFFER10.priceSar} SAR): Nano Banana Pro + GPT Image 2 + Seedance 2.0`;
  // our own page with Moyasar's form (the Payments API), settled by settleOffer10Payment; the invoice page only without its key
  if (formEnabled()) return { url: checkoutUrl(origin, { k: "offer10", ref: user.id, a: halalas(OFFER10.priceSar), d: description, back: OFFER10.path }) };
  const back = `${origin}${OFFER10.path}`;
  const settle = `${origin}/api/jawad/offer10/settle?u=${encodeURIComponent(user.id)}`;
  const inv = await createInvoice({
    amount: OFFER10.priceSar,
    description,
    callbackUrl: settle,
    successUrl: `${settle}&back=1`,
    backUrl: back,
  });
  await writePass(user.id, { ...pass, invoices: [...pass.invoices, inv.id].slice(-10) });
  return { url: inv.url };
}

/** Reads this person's invoices from Moyasar; the first paid one starts the offer (once). */
export async function settleOffer10(userId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const pass = await readPass(userId);
  if (pass.paidAt) return true;
  for (const id of pass.invoices.slice().reverse()) {
    const inv = await getInvoice(id).catch(() => null);
    if (inv && invoicePaid(inv, id, OFFER10.priceSar)) {
      await writePass(userId, { ...pass, paidAt: new Date().toISOString(), invoiceId: id });
      return true;
    }
  }
  return false;
}

/** A payment on our checkout page, READ from Moyasar by the caller: a paid one for the offer's price, made for this account, starts it (once). */
export async function settleOffer10Payment(userId: string, p: Payment): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return false;
  const pass = await readPass(userId);
  if (pass.paidAt) return true;
  if (!formPaymentPaid(p, "offer10", userId, halalas(OFFER10.priceSar))) return false;
  await writePass(userId, { ...pass, paidAt: new Date().toISOString(), invoiceId: `pay:${p.id}` });
  return true;
}

export interface Offer10Use {
  key: Offer10Key;
  name: string;
  generatorId: string;
  line: string;
  unit: string;
  cap: number | null;
  used: number;
  /** null = no limit */
  left: number | null;
  until: string;
  active: boolean;
}

/** How many of a grant this person used since paying (pictures add up their count; failed or cancelled jobs are not counted). */
async function usedOf(userId: string, generatorId: string, since: string): Promise<number> {
  const { data } = await db()
    .from("jawad_jobs")
    .select("inputs")
    .eq("user_id", userId)
    .eq("generator_id", generatorId)
    .eq("inputs->>offer10", "true")
    .not("status", "in", "(failed,cancelled)")
    .gte("created_at", since);
  return (data ?? []).reduce((n, r) => n + Math.max(1, Number((r.inputs as { settings?: { count?: unknown } })?.settings?.count ?? 1) || 1), 0);
}

/** What this person has of the offer now (empty when not paid). */
export async function offer10Status(userId: string, now = Date.now()): Promise<Offer10Use[]> {
  const paidAt = await offer10PaidAt(userId);
  if (!paidAt) return [];
  const paid = Date.parse(paidAt);
  return Promise.all(
    OFFER10_GRANTS.map(async (g) => {
      const until = paid + g.hours * 3600_000;
      const used = await usedOf(userId, g.generatorId, paidAt).catch(() => 0);
      const left = g.cap == null ? null : Math.max(0, g.cap - used);
      return { key: g.key, name: g.name, generatorId: g.generatorId, line: g.line, unit: g.unit, cap: g.cap, used, left, until: new Date(until).toISOString(), active: now < until && (left == null || left > 0) };
    }),
  );
}

/**
 * Is this job free under the offer? Only a paid, still-running grant for this generator, at the grant's resolution, and
 * (when it has a limit) with room for the job's whole count.
 */
export async function offer10Covers(userId: string, generatorId: string, settings: Record<string, unknown>): Promise<boolean> {
  const g = offer10GrantFor(generatorId);
  if (!g) return false;
  const paidAt = await offer10PaidAt(userId);
  if (!paidAt || Date.now() >= Date.parse(paidAt) + g.hours * 3600_000) return false;
  if (g.resolution && String(settings.resolution ?? "") !== g.resolution) return false;
  if (g.cap == null) return true;
  const count = Math.max(1, Number(settings.count ?? 1) || 1);
  return (await usedOf(userId, generatorId, paidAt)) + count <= g.cap;
}
