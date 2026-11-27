// SERVER ONLY. «تصويت محبوبة الباري» (/mahdi/vote): keeps a visitor's vote and reads the results for the owners.
import { createHash } from "node:crypto";
import { VOTE_LIMITS, VOTE_PERFORMERS, VOTE_POINTS } from "@config/mahdi-vote";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLE = "mahdi_qasida_votes";
const LINK = /(https?:\/\/|www\.|t\.me\/|wa\.me\/|\b[a-z0-9-]{2,}\.(com|net|org|io|me|ly|co|sa|xyz|app|site|online|ru|shop|store|top|click)\b)/i;
// control characters (a new line included) and anything shaped like a tag are dropped
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F‎‏‪-‮]/g;
const TAG = /<[^>]*>/g;

const tidy = (raw: unknown, max: number) =>
  String(raw ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL, "")
    .replace(TAG, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max * 2);

/** The name as written, or null when it is empty, too long or a link. */
export function cleanVoterName(raw: unknown): string | null {
  const s = tidy(raw, VOTE_LIMITS.name).replace(/\n/g, " ");
  if (!s || s.length > VOTE_LIMITS.name || LINK.test(s)) return null;
  return s;
}

/** The same name however it was spelled (diacritics, hamza, ة/ه, ى/ي, spaces): the same-name check compares these. */
export function nameKey(name: string): string {
  return name
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[()«»"'.,،\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, VOTE_LIMITS.name);
}

/** A one-way hash of the sender's address (salted with a server secret): the limits, never the address kept. */
export const voteAddressHash = (ip: string) => createHash("sha256").update(`${process.env.SUPABASE_SERVICE_ROLE_KEY ?? "mahdi"}:qasida-vote:${ip}`).digest("hex").slice(0, 40);

/** A script fills the hidden field, or sends before a person could have read the page. */
const looksLikeBot = (b: Record<string, unknown>) => (typeof b.website === "string" && b.website.trim() !== "") || !(Number(b.typedMs) >= 1500);

/** the table is not there yet (the migration not run): the vote is refused kindly */
const missingTable = (e: unknown) => {
  const code = (e as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205" || code === "PGRST204";
};
const NOT_READY = "التصويت يجهز الحين؛ جرّب بعد شوي.";

/** Keeps one vote. Refused: no name, no (or an unknown) choice, a long reason, too many from one address, the same name twice. */
export async function saveVote(b: Record<string, unknown>, ip: string, now = Date.now()): Promise<{ ok: true }> {
  const name = cleanVoterName(b.name);
  if (!name) throw new UserError("اكتب اسمك (٤٠ حرف بالأكثر).", 400);
  const performer = VOTE_PERFORMERS.find((p) => p.id === b.performer);
  if (!performer) throw new UserError("اختر الأداء اللي تصوّت له.", 400);
  if (typeof b.reason === "string" && b.reason.length > VOTE_LIMITS.reason * 2) throw new UserError("السبب طويل؛ اختصره شوي.", 400);
  const reason = tidy(b.reason, VOTE_LIMITS.reason);
  if (reason.length > VOTE_LIMITS.reason) throw new UserError("السبب طويل؛ اختصره شوي.", 400);
  if (looksLikeBot(b)) return { ok: true };

  const db = createAdminClient();
  const hash = voteAddressHash(ip);
  const key = nameKey(name) || name;
  const hourAgo = new Date(now - 3600_000).toISOString();
  const recent = await db.from(TABLE).select("id", { count: "exact", head: true }).eq("ip_hash", hash).gt("created_at", hourAgo);
  if (recent.error) throw missingTable(recent.error) ? new UserError(NOT_READY, 503) : recent.error;
  if ((recent.count ?? 0) >= VOTE_LIMITS.perAddressHour) throw new UserError("أصوات كثيرة من نفس الجهاز في وقت قصير؛ جرّب بعد ساعة.", 429);
  const since = new Date(now - VOTE_LIMITS.sameNameMinutes * 60_000).toISOString();
  const same = await db.from(TABLE).select("id", { count: "exact", head: true }).eq("name_key", key).eq("ip_hash", hash).gt("created_at", since);
  if (same.error) throw same.error;
  if ((same.count ?? 0) > 0) throw new UserError("صوّتت قبل بهذا الاسم. شكرًا لك!", 409, { already: true });

  const { error } = await db.from(TABLE).insert({ name, name_key: key, performer: performer.id, reason, radood: b.radood === true, ip_hash: hash });
  if (error) throw missingTable(error) ? new UserError(NOT_READY, 503) : new UserError("ما انحفظ صوتك؛ جرّب مرة ثانية.", 500);
  return { ok: true };
}

export interface VoteRow {
  id: number;
  name: string;
  performer: string;
  reason: string;
  radood: boolean;
  created_at: string;
}

export interface VoteTally {
  id: string;
  name: string;
  photo: string;
  votes: number;
  radood: number;
  points: number;
}

/** Every vote (newest first) and the count per performer: raw votes and points (a radood's vote counts 2). Null: not ready. */
export async function loadVoteResults(): Promise<{ rows: VoteRow[]; tally: VoteTally[] } | null> {
  const db = createAdminClient();
  const rows: VoteRow[] = [];
  for (let from = 0; from < 20_000; from += 1000) {
    const { data, error } = await db.from(TABLE).select("id, name, performer, reason, radood, created_at").order("id", { ascending: false }).range(from, from + 999);
    if (error) {
      if (missingTable(error)) return null;
      throw error;
    }
    rows.push(...((data ?? []) as VoteRow[]));
    if (!data || data.length < 1000) break;
  }
  const tally: VoteTally[] = VOTE_PERFORMERS.map((p) => {
    const mine = rows.filter((r) => r.performer === p.id);
    const radood = mine.filter((r) => r.radood).length;
    return { id: p.id, name: p.name, photo: p.photo, votes: mine.length, radood, points: radood * VOTE_POINTS.radood + (mine.length - radood) * VOTE_POINTS.public };
  }).sort((a, b) => b.points - a.points || b.votes - a.votes);
  return { rows, tally };
}
