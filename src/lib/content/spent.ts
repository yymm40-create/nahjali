// «أُخذ منك في هذي المحادثة» in «صانع المحتوى»: EVERYTHING the conversation took from the wallet, worked out from the
// records themselves — so a conversation started before this was counted shows its whole total too:
//   - «محمد باقر»'s replies (the ledger's «محادثة محمد باقر», or for a free account what each would have cost);
//   - GPT Image 2's pictures and the videos جواد made for it (its jobs, keyed «c-…» / «m-…» by the content maker; a job
//     that failed was given back, so it counts nothing);
//   - «حيدرا ماكس»'s code and reviews of each slide (the ledger's «حيدرا ماكس · …»).
// The ledger keeps no conversation id, so each charge goes to the conversation it belongs to by its records: a picture
// to the conversation its file was saved in; «حيدرا ماكس»'s work to the conversation whose slide was saved right after
// it; a reply to the conversation that was being talked in at that moment. Pure parts first (tested), then the reads.
// Server only for the reads.

import { createAdminClient } from "@/lib/supabase/admin";

export const BAQIR_LABEL = "محادثة محمد باقر";
const MAX_PREFIX = "حيدرا ماكس · ";
/** The content maker's own jobs (produce: «c-», the media step: «m-»). */
const DESK_KEY = /^[cm]-[0-9a-f]{32}$/;
/** «حيدرا ماكس»'s work is followed by its slide's file within this long (a motion slide renders and uploads first). */
const MAX_WINDOW_MS = 20 * 60_000;
/** A picture with no file of its own (painted again, or a slide that failed after it) goes to the next file within this. */
const JOB_WINDOW_MS = 30 * 60_000;
/** A conversation is «being talked in» from a little before it was made until a little after it was last saved. */
const SLACK_MS = 2 * 60_000;

export interface SpentChat { id: string; createdAt: number; updatedAt: number }
export interface SpentFile { chatId: string; at: number; jobId: string | null }
export interface SpentJob { id: string; key: string; at: number; chargeState: string; status: string; priceCoins: number }
/** One Claude call: what it took (or, free, what it would have cost), its label and when. */
export interface SpentCall { at: number; label: string; halalas: number }

/** What a content job took: its price when it was held or settled; a free account's made job, its value; a refund, nothing. */
export function jobHalalas(j: SpentJob): number {
  if (j.chargeState === "held" || j.chargeState === "settled") return Math.max(0, j.priceCoins);
  if (j.chargeState === "none" && j.status === "succeeded") return Math.max(0, j.priceCoins);
  return 0;
}

/** Each conversation's whole total (halalas), from the records. */
export function tallyContent(o: { chats: SpentChat[]; files: SpentFile[]; jobs: SpentJob[]; calls: SpentCall[] }): Map<string, number> {
  const files = [...o.files].sort((a, b) => a.at - b.at);
  const byJob = new Map(files.filter((f) => f.jobId).map((f) => [f.jobId!, f.chatId]));
  const chatIds = new Set(o.chats.map((c) => c.id));
  const nextFile = (at: number, windowMs: number) => files.find((f) => f.at >= at - 5_000 && f.at <= at + windowMs)?.chatId ?? null;
  // the conversation being talked in: of those open at that moment, the one started last
  const talkedIn = (at: number) => {
    let best: SpentChat | null = null;
    for (const c of o.chats) if (c.createdAt - SLACK_MS <= at && at <= c.updatedAt + SLACK_MS && (!best || c.createdAt > best.createdAt)) best = c;
    return best?.id ?? null;
  };
  const out = new Map<string, number>();
  const add = (chatId: string | null, halalas: number) => {
    if (!chatId || !chatIds.has(chatId) || !(halalas > 0)) return;
    out.set(chatId, (out.get(chatId) ?? 0) + Math.round(halalas));
  };
  for (const j of o.jobs) {
    if (!DESK_KEY.test(j.key)) continue;
    add(byJob.get(j.id) ?? nextFile(j.at, JOB_WINDOW_MS) ?? talkedIn(j.at), jobHalalas(j));
  }
  for (const c of o.calls) {
    if (c.label === BAQIR_LABEL) add(talkedIn(c.at), c.halalas);
    else if (c.label.startsWith(MAX_PREFIX)) {
      // a slide («الشريحة») is the content maker's alone; a picture («الصورة») may be the studio's, so only when a slide followed
      const slide = c.label.includes("شريحة");
      if (slide || c.label.includes("الصورة")) add(nextFile(c.at, MAX_WINDOW_MS) ?? (slide ? talkedIn(c.at) : null), c.halalas);
    }
  }
  return out;
}

// ───────── the reads ─────────

const db = () => createAdminClient();
const ms = (v: unknown) => new Date(String(v)).getTime();
const PAGE = 1000;

/** Every row of a query, a page at a time (the database answers at most a thousand at once). */
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>, cap = 20_000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < cap; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

/**
 * The conversation's whole total now (halalas), or null when it isn't this person's. Only what happened since it was
 * started is read (and the conversations open since then, so a charge goes to the right one). `kept`: the running
 * total of «محمد باقر»'s replies the conversation already keeps — the larger of the two counts the replies.
 */
export async function contentSpent(userId: string, chatId: string): Promise<number | null> {
  const { data: chat } = await db().from("content_chats").select("id,created_at,spent_halalas").eq("id", chatId).eq("user_id", userId).maybeSingle();
  if (!chat) return null;
  const since = new Date(ms(chat.created_at) - SLACK_MS).toISOString();
  const [chats, files, jobs, paid, free] = await Promise.all([
    all<Record<string, unknown>>((a, b) => db().from("content_chats").select("id,created_at,updated_at").eq("user_id", userId).gte("updated_at", since).order("created_at").range(a, b)),
    all<Record<string, unknown>>((a, b) => db().from("content_files").select("chat_id,created_at,deskJob:meta->desk->>jobId,mediaJob:meta->>jobId").eq("user_id", userId).gte("created_at", since).order("created_at").range(a, b)),
    all<Record<string, unknown>>((a, b) => db().from("jawad_jobs").select("id,idempotency_key,status,charge_state,price_coins,created_at").eq("user_id", userId).gte("created_at", since).or("idempotency_key.like.c-*,idempotency_key.like.m-*").order("created_at").range(a, b)),
    all<Record<string, unknown>>((a, b) => db().from("smart_coin_ledger").select("ref,delta,label,created_at").eq("user_id", userId).gte("created_at", since).like("ref", "claude:%").order("created_at").range(a, b)),
    all<Record<string, unknown>>((a, b) => db().from("site_free_usage").select("ref,halalas,label,created_at").eq("user_id", userId).gte("created_at", since).like("ref", "claude:%").order("created_at").range(a, b)),
  ]);
  // a paid call is its reserve, settle and refund under one ref: what it took in the end
  const byRef = new Map<string, SpentCall>();
  for (const r of paid) {
    const ref = String(r.ref);
    const hit = byRef.get(ref) ?? { at: ms(r.created_at), label: String(r.label ?? ""), halalas: 0 };
    hit.halalas -= Number(r.delta) || 0;
    byRef.set(ref, hit);
  }
  const calls: SpentCall[] = [...byRef.values(), ...free.map((r) => ({ at: ms(r.created_at), label: String(r.label ?? ""), halalas: Number(r.halalas) || 0 }))];
  const totals = tallyContent({
    chats: chats.map((c) => ({ id: String(c.id), createdAt: ms(c.created_at), updatedAt: ms(c.updated_at) })),
    files: files.map((f) => ({ chatId: String(f.chat_id), at: ms(f.created_at), jobId: (f.deskJob as string | null) ?? (f.mediaJob as string | null) ?? null })),
    jobs: jobs.map((j) => ({ id: String(j.id), key: String(j.idempotency_key ?? ""), at: ms(j.created_at), chargeState: String(j.charge_state ?? ""), status: String(j.status ?? ""), priceCoins: Number(j.price_coins) || 0 })),
    calls,
  });
  // the replies this conversation counted as they happened: never show less than that
  const replies = tallyContent({ chats: chats.map((c) => ({ id: String(c.id), createdAt: ms(c.created_at), updatedAt: ms(c.updated_at) })), files: [], jobs: [], calls: calls.filter((c) => c.label === BAQIR_LABEL) }).get(chatId) ?? 0;
  const kept = Math.max(0, Number(chat.spent_halalas ?? 0));
  return (totals.get(chatId) ?? 0) + Math.max(0, kept - replies);
}
