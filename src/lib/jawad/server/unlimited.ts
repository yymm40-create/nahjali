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

/** A use made outside the studio's jobs (the film maker, the student, the editor's hook): kept next to the purchases. */
interface ExtraUse {
  paid: string;
  cycle: number;
  units: number;
  fast: boolean;
  at: string;
  ref: string;
}

async function readExtras(userId: string): Promise<ExtraUse[]> {
  const { data } = await db().from("jawad_settings").select("value").eq("key", keyOf(userId)).maybeSingle();
  const list = (data?.value as { extra?: unknown } | null)?.extra;
  return Array.isArray(list) ? (list as ExtraUse[]).filter((x) => x && typeof x.paid === "string") : [];
}

async function writeBought(userId: string, bought: Bought[], extra?: ExtraUse[]) {
  const keep = extra ?? (await readExtras(userId));
  const { error } = await db().from("jawad_settings").upsert({ key: keyOf(userId), value: { bought: bought.slice(-50), extra: keep.slice(-500) }, updated_at: new Date().toISOString(), updated_by: userId });
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

/** The jobs made under this purchase (not failed or cancelled), with its uses outside the studio's jobs. */
async function jobsOf(userId: string, b: Bought): Promise<PassJob[]> {
  const [{ data }, extras] = await Promise.all([
    db().from("jawad_jobs").select("inputs").eq("user_id", userId).eq("inputs->unlimited->>paid", b.paidAt).not("status", "in", "(failed,cancelled)"),
    readExtras(userId).catch(() => [] as ExtraUse[]),
  ]);
  return [...((data ?? []) as PassJob[]), ...extras.filter((x) => x.paid === b.paidAt).map((x) => ({ inputs: { unlimited: { pass: "", fast: x.fast, units: x.units, cycle: x.cycle } } }))];
}

/**
 * «لامحدود» outside the studio's jobs (the film maker's videos and pictures, the student's illustrations, «حيدرة كت»'s hook): these
 * run at once and cannot wait, so a pass makes them free only while its FAST balance covers them; the use is counted at once.
 * True = free (and counted); false = charged as usual (no pass, or the fast balance is used up — the studio still takes it slowly).
 */
export async function takeUnlimitedFast(userId: string, generatorId: string, settings: Record<string, unknown>, ref: string, now = Date.now()): Promise<boolean> {
  try {
    const t = await unlimitedTicket(userId, generatorId, settings, now);
    if (!t || !t.inputs.fast) return false;
    const [bought, extras] = await Promise.all([readBought(userId), readExtras(userId)]);
    if (extras.some((x) => x.ref === ref)) return true;
    await writeBought(userId, bought, [...extras, { paid: t.inputs.paid, cycle: t.inputs.cycle, units: t.inputs.units, fast: true, at: new Date(now).toISOString(), ref: ref.slice(0, 120) }]);
    return true;
  } catch (e) {
    console.error("unlimited fast take", userId, e);
    return false;
  }
}

/** A free use that did not happen after all (the generation failed): its fast balance comes back. */
export async function giveBackUnlimitedFast(userId: string, ref: string) {
  try {
    const extras = await readExtras(userId);
    if (!extras.some((x) => x.ref === ref)) return;
    await writeBought(userId, await readBought(userId), extras.filter((x) => x.ref !== ref));
  } catch (e) {
    console.error("unlimited give back", userId, e);
  }
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

// ───────────────────────────── the owner's follow-up room ─────────────────────────────

export interface RoomJob {
  id: string;
  status: string;
  generatorId: string;
  fast: boolean;
  units: number;
  createdAt: string;
  holdUntil: string | null;
  prompt: string;
}

export interface RoomPass {
  pass: string;
  name: string;
  quality?: string;
  kind: "video" | "image";
  hours: UnlimitedHours;
  priceSar: number;
  paidAt: string;
  until: string;
  active: boolean;
  /** jobs made under it (all states) */
  jobs: RoomJob[];
  made: number;
  failed: number;
  /** seconds of video or pictures, of the jobs that did not fail */
  units: number;
  fastLeft: number;
  fastCap: number;
  /** slow jobs in this cycle (the next one waits longer) */
  slowInCycle: number;
}

export interface RoomPerson {
  userId: string;
  email: string;
  passes: RoomPass[];
  /** what is happening now: generating, waiting (held until), or idle */
  now: { state: "idle" | "working" | "held"; until?: string; count: number };
  lastAt: string | null;
  spentSar: number;
}

/** Everyone who bought a pass: what they bought, what they made with it, how much, and what is happening for them now. */
export async function unlimitedRoom(emails: Map<string, string>, now = Date.now()): Promise<RoomPerson[]> {
  const { data: rows } = await db().from("jawad_settings").select("key, value").like("key", "unlimited:%");
  const people: RoomPerson[] = [];
  for (const r of rows ?? []) {
    const userId = String(r.key).slice("unlimited:".length);
    const list = (r.value as { bought?: Bought[] } | null)?.bought ?? [];
    const extras = ((r.value as { extra?: ExtraUse[] } | null)?.extra ?? []).filter((x) => x && typeof x.paid === "string");
    if (!list.length) continue;
    const { data: jobRows } = await db()
      .from("jawad_jobs")
      .select("id, status, generator_id, inputs, created_at, prompt")
      .eq("user_id", userId)
      .not("inputs->unlimited", "is", null)
      .order("created_at", { ascending: false })
      .limit(500);
    const jobs = (jobRows ?? []) as { id: string; status: string; generator_id: string; inputs: PassJob["inputs"] & { unlimited?: { paid?: string; holdUntil?: string } }; created_at: string; prompt: string }[];
    const passes: RoomPass[] = list.flatMap((b) => {
      const pass = unlimitedPass(b.pass);
      if (!pass) return [];
      const mine = jobs.filter((j) => j.inputs.unlimited?.paid === b.paidAt);
      const ok = mine.filter((j) => !["failed", "cancelled"].includes(j.status));
      const cycle = cycleOf(b, now);
      const inCycle = ok.filter((j) => j.inputs.unlimited?.cycle === cycle);
      const cap = UNLIMITED.fast[pass.kind];
      const fastUsed = inCycle.filter((j) => j.inputs.unlimited?.fast).reduce((n, j) => n + (j.inputs.unlimited?.units ?? 0), 0) + extras.filter((x) => x.paid === b.paidAt && x.cycle === cycle && x.fast).reduce((n, x) => n + x.units, 0);
      return [
        {
          pass: pass.key,
          name: pass.name,
          quality: pass.quality,
          kind: pass.kind,
          hours: b.hours,
          priceSar: passPrice(pass, b.hours),
          paidAt: b.paidAt,
          until: new Date(endOf(b)).toISOString(),
          active: running(b, now),
          jobs: mine.map((j) => ({ id: j.id, status: j.status, generatorId: j.generator_id, fast: !!j.inputs.unlimited?.fast, units: j.inputs.unlimited?.units ?? 0, createdAt: j.created_at, holdUntil: j.inputs.unlimited?.holdUntil ?? null, prompt: (j.prompt ?? "").slice(0, 160) })),
          // with the uses outside the studio (the film maker, the student, the editor's hook)
          made: ok.length + extras.filter((x) => x.paid === b.paidAt).length,
          failed: mine.length - ok.length,
          units: ok.reduce((n, j) => n + (j.inputs.unlimited?.units ?? 0), 0) + extras.filter((x) => x.paid === b.paidAt).reduce((n, x) => n + x.units, 0),
          fastLeft: running(b, now) ? Math.max(0, cap - fastUsed) : 0,
          fastCap: cap,
          slowInCycle: inCycle.filter((j) => !j.inputs.unlimited?.fast).length,
        },
      ];
    });
    const open = jobs.filter((j) => ["queued", "submitting", "running", "saving"].includes(j.status));
    const held = open.filter((j) => heldNow(j.inputs, now));
    const state: RoomPerson["now"]["state"] = held.length ? "held" : open.length ? "working" : "idle";
    const until = held.map((j) => j.inputs.unlimited?.holdUntil ?? "").sort().at(-1);
    people.push({
      userId,
      email: emails.get(userId) ?? userId,
      passes,
      now: { state, ...(state === "held" && until ? { until } : {}), count: open.length },
      lastAt: jobs[0]?.created_at ?? null,
      spentSar: passes.reduce((n, p) => n + p.priceSar, 0),
    });
  }
  // the active ones first, then the most recent
  return people.sort((a, b) => Number(b.passes.some((p) => p.active)) - Number(a.passes.some((p) => p.active)) || String(b.lastAt ?? b.passes[0]?.paidAt ?? "").localeCompare(String(a.lastAt ?? a.passes[0]?.paidAt ?? "")));
}
