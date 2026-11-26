// «لامحدود · UNLIMITED» (config/jawad/unlimited.ts): buying a pass through our checkout page (Moyasar's form), what a person
// has now, and how a job under a pass goes: free, fast while the cycle's balance lasts, then held before it is sent. Server only.
// Purchases are kept in jawad_settings under «unlimited:<user id>» (no new table). Jobs under a pass carry `inputs.unlimited`
// ({ pass, fast, units, cycle, holdUntil? }); the fast balance and the waits are counted from those jobs (failed / cancelled
// ones never count).

import { UserError } from "@/lib/api";
import { halalas, moyasarEnabled, type Payment } from "@/lib/credits/moyasar";
import { checkoutUrl, formEnabled, formPaymentPaid } from "@/lib/credits/checkout";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  UNLIMITED,
  UNLIMITED_PASSES,
  fastUnits,
  holdFor,
  passCovers,
  passPrice,
  unlimitedPass,
  unlimitedPhase,
  type UnlimitedHours,
  type UnlimitedPass,
} from "@config/jawad/unlimited";

const db = () => createAdminClient();
const keyOf = (userId: string) => `unlimited:${userId}`;
const H = 3600_000;

export interface Bought {
  pass: string;
  hours: UnlimitedHours;
  paidAt: string;
  paymentId: string;
}

async function readBought(userId: string): Promise<Bought[]> {
  const { data } = await db().from("jawad_settings").select("value").eq("key", keyOf(userId)).maybeSingle();
  const list = (data?.value as { bought?: unknown } | null)?.bought;
  return Array.isArray(list)
    ? list.flatMap((b) => {
        const x = b as Partial<Bought>;
        return typeof x.pass === "string" && (x.hours === 24 || x.hours === 12) && typeof x.paidAt === "string" && typeof x.paymentId === "string" ? [x as Bought] : [];
      })
    : [];
}

async function writeBought(userId: string, bought: Bought[]) {
  const { error } = await db().from("jawad_settings").upsert({ key: keyOf(userId), value: { bought: bought.slice(-50) }, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) throw error;
}

const endOf = (b: Bought) => Date.parse(b.paidAt) + b.hours * H;
const running = (b: Bought, now = Date.now()) => now < endOf(b);

/** The ref on the payment: account, pass and hours (checked again when it is settled). */
const refOf = (userId: string, pass: string, hours: UnlimitedHours) => `${userId}|${pass}|${hours}`;

/** Starts a purchase: our checkout page for this pass's price, tied to this account. */
export async function startUnlimited(user: { id: string }, origin: string, passKey: unknown, hoursRaw: unknown): Promise<{ url: string }> {
  const pass = unlimitedPass(String(passKey ?? ""));
  if (!pass) throw new UserError("اختر المولّد من جديد.", 400);
  const hours: UnlimitedHours = Number(hoursRaw) === 12 ? 12 : 24;
  if (unlimitedPhase() !== "open") throw new UserError(unlimitedPhase() === "before" ? "العرض ما بدأ للحين." : "انتهى وقت العرض.", 410);
  if (!moyasarEnabled() || !formEnabled()) throw new UserError("الدفع بالبطاقة غير متاح الحين، تواصل معنا.", 503);
  if ((await readBought(user.id)).some((b) => b.pass === pass.key && running(b))) throw new UserError("عندك هذا اللامحدود شغّال الحين.", 409);
  const price = passPrice(pass, hours);
  const description = `لامحدود ${hours} ساعة · ${pass.name}${pass.quality ? ` ${pass.quality}` : ""} (${price} SAR)`;
  return { url: checkoutUrl(origin, { k: "unlim", ref: refOf(user.id, pass.key, hours), a: halalas(price), d: description, back: `${UNLIMITED.path}/${pass.kind === "video" ? "video" : "images"}` }) };
}

/** A payment READ from Moyasar by the caller: paid, for this pass's price, made for this ref → the pass starts (once per payment). */
export async function settleUnlimitedPayment(ref: string, p: Payment): Promise<{ paid: boolean; kind: "video" | "image" | null }> {
  const [userId, passKey, h] = ref.split("|");
  const pass = unlimitedPass(passKey ?? "");
  const hours: UnlimitedHours = Number(h) === 12 ? 12 : 24;
  if (!/^[0-9a-f-]{36}$/i.test(userId ?? "") || !pass) return { paid: false, kind: null };
  if (!formPaymentPaid(p, "unlim", ref, halalas(passPrice(pass, hours)))) return { paid: false, kind: pass.kind };
  const bought = await readBought(userId);
  if (!bought.some((b) => b.paymentId === p.id)) await writeBought(userId, [...bought, { pass: pass.key, hours, paidAt: new Date().toISOString(), paymentId: p.id }]);
  return { paid: true, kind: pass.kind };
}

interface PassJob {
  inputs: { unlimited?: { pass?: string; fast?: boolean; units?: number; cycle?: number }; settings?: Record<string, unknown> };
}

/** The jobs made under this purchase (not failed or cancelled). */
async function jobsOf(userId: string, b: Bought): Promise<PassJob[]> {
  const { data } = await db()
    .from("jawad_jobs")
    .select("inputs")
    .eq("user_id", userId)
    .eq("inputs->unlimited->>paid", b.paidAt)
    .not("status", "in", "(failed,cancelled)");
  return (data ?? []) as PassJob[];
}

const cycleOf = (b: Bought, now: number) => Math.floor((now - Date.parse(b.paidAt)) / (UNLIMITED.cycleHours * H));

export interface UnlimitedUse {
  pass: string;
  name: string;
  quality?: string;
  kind: "video" | "image";
  generatorId: string;
  hours: UnlimitedHours;
  until: string;
  /** what is left of this cycle's fast balance (seconds or pictures) */
  fastLeft: number;
  fastCap: number;
  /** when the next cycle (a full fast balance) starts, if before the end */
  refill: string | null;
}

/** What passes this person has running now. */
export async function unlimitedStatus(userId: string, now = Date.now()): Promise<UnlimitedUse[]> {
  const bought = (await readBought(userId).catch(() => [])).filter((b) => running(b, now));
  return Promise.all(
    bought.flatMap((b) => {
      const pass = unlimitedPass(b.pass);
      if (!pass) return [];
      return [
        (async () => {
          const cycle = cycleOf(b, now);
          const used = (await jobsOf(userId, b).catch(() => [])).filter((j) => j.inputs.unlimited?.fast && j.inputs.unlimited.cycle === cycle).reduce((n, j) => n + (j.inputs.unlimited?.units ?? 0), 0);
          const cap = UNLIMITED.fast[pass.kind];
          const next = Date.parse(b.paidAt) + (cycle + 1) * UNLIMITED.cycleHours * H;
          return { pass: pass.key, name: pass.name, quality: pass.quality, kind: pass.kind, generatorId: pass.generatorId, hours: b.hours, until: new Date(endOf(b)).toISOString(), fastLeft: Math.max(0, cap - used), fastCap: cap, refill: next < endOf(b) ? new Date(next).toISOString() : null };
        })(),
      ];
    }),
  );
}

export interface UnlimitedTicket {
  /** stored on the job as `inputs.unlimited` */
  inputs: { pass: string; paid: string; fast: boolean; units: number; cycle: number; holdUntil?: string };
  pass: UnlimitedPass;
  /** ms the job waits before it is sent (0 = fast) */
  holdMs: number;
}

/**
 * Is this job under a running pass, and how does it go? Fast while this cycle's balance covers the whole job, otherwise held:
 * the n-th slow job of the cycle waits holdFor(n). Null when no running pass covers it (then it is paid as usual).
 */
export async function unlimitedTicket(userId: string, generatorId: string, settings: Record<string, unknown>, now = Date.now()): Promise<UnlimitedTicket | null> {
  const bought = (await readBought(userId)).filter((b) => running(b, now));
  for (const b of bought) {
    const pass = unlimitedPass(b.pass);
    if (!pass || !passCovers(pass, generatorId, settings)) continue;
    const cycle = cycleOf(b, now);
    const units = fastUnits(pass.kind, settings);
    const inCycle = (await jobsOf(userId, b)).filter((j) => j.inputs.unlimited?.cycle === cycle);
    const used = inCycle.filter((j) => j.inputs.unlimited?.fast).reduce((n, j) => n + (j.inputs.unlimited?.units ?? 0), 0);
    if (used + units <= UNLIMITED.fast[pass.kind]) return { inputs: { pass: pass.key, paid: b.paidAt, fast: true, units, cycle }, pass, holdMs: 0 };
    const slow = inCycle.filter((j) => j.inputs.unlimited && !j.inputs.unlimited.fast).length;
    const holdMs = holdFor(pass.kind, slow);
    return { inputs: { pass: pass.key, paid: b.paidAt, fast: false, units, cycle, holdUntil: new Date(now + holdMs).toISOString() }, pass, holdMs };
  }
  return null;
}

/** Still waiting before it may be sent? */
export const heldNow = (inputs: { unlimited?: { holdUntil?: string } } | null | undefined, now = Date.now()) => {
  const t = inputs?.unlimited?.holdUntil ? Date.parse(inputs.unlimited.holdUntil) : NaN;
  return Number.isFinite(t) && t > now;
};

export { UNLIMITED_PASSES };
