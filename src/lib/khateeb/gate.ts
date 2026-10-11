// «الخطيب الذكي» — the door: the secret link's word, the password and the cookie that remembers it was given. The owner sets
// the word and the password from /jawad-ai/admin/khateeb; only the password's scrypt hash is kept. Server only.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSlug, DEFAULT_METHOD, KHATEEB, METHOD_MAX, PASSWORD_MAX, PASSWORD_MIN, POEMS_MAX } from "@config/jawad/khateeb";

const db = () => createAdminClient();
const T = "khateeb_settings";
export const NOT_READY = "«الخطيب الذكي» ما تجهّز بعد: شغّل ملف SQL رقم 0065 في Supabase.";

const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(e.message ?? ""));

export interface Settings {
  /** the link's word ("" = not opened yet: the branch does not exist for anyone) */
  slug: string;
  /** a password is set */
  hasPassword: boolean;
  /** bumps with every new password: the old cookies stop working */
  version: number;
  method: string;
  poems: string;
  ready: boolean;
}

const EMPTY: Settings = { slug: "", hasPassword: false, version: 0, method: DEFAULT_METHOD, poems: "", ready: true };

async function rows(): Promise<{ kv: Record<string, string>; ready: boolean }> {
  const { data, error } = await db().from(T).select("key,value");
  if (error) return { kv: {}, ready: !missing(error) };
  return { kv: Object.fromEntries((data ?? []).map((r) => [r.key as string, String(r.value ?? "")])), ready: true };
}

export async function loadSettings(): Promise<Settings> {
  const { kv, ready } = await rows();
  return { ...EMPTY, slug: cleanSlug(kv.slug), hasPassword: !!kv.password, version: Number(kv.version) || 0, method: kv.method?.trim() ? kv.method : DEFAULT_METHOD, poems: kv.poems ?? "", ready };
}

/** Just the words the writer is told with (the method and the poems). */
export async function khateebWords(): Promise<{ method: string; poems: string }> {
  const s = await loadSettings();
  return { method: s.method, poems: s.poems };
}

async function put(entries: Record<string, string>) {
  const at = new Date().toISOString();
  const { error } = await db().from(T).upsert(Object.entries(entries).map(([key, value]) => ({ key, value, updated_at: at })));
  if (error) {
    if (missing(error)) throw new UserError(NOT_READY, 503);
    throw error;
  }
}

// ───────────────────────────── the password ─────────────────────────────

const hashOf = (pw: string) => {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(pw, salt, 32).toString("hex")}`;
};
const matches = (pw: string, stored: string) => {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = scryptSync(pw, Buffer.from(salt, "hex"), 32);
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};

/** The owner's changes: a new link word, a new password, the method, the poems (each only when given). */
export async function saveSettings(p: { slug?: unknown; password?: unknown; method?: unknown; poems?: unknown; newSlug?: boolean }): Promise<Settings> {
  const cur = await loadSettings();
  if (!cur.ready) throw new UserError(NOT_READY, 503);
  const out: Record<string, string> = {};
  if (p.newSlug) out.slug = randomBytes(6).toString("hex") + "-" + randomBytes(3).toString("hex");
  else if (p.slug !== undefined) {
    const s = cleanSlug(p.slug);
    if (!s) throw new UserError("كلمة الرابط: حروف إنجليزية صغيرة وأرقام وشرطات، من ٦ إلى ٤٠ حرفًا.", 400);
    out.slug = s;
  }
  if (p.password !== undefined && String(p.password) !== "") {
    const pw = String(p.password);
    if (pw.length < PASSWORD_MIN || pw.length > PASSWORD_MAX) throw new UserError(`كلمة السر من ${PASSWORD_MIN} إلى ${PASSWORD_MAX} حرفًا.`, 400);
    out.password = hashOf(pw);
    out.version = String(cur.version + 1);
  }
  if (p.method !== undefined) out.method = String(p.method).slice(0, METHOD_MAX);
  if (p.poems !== undefined) out.poems = String(p.poems).slice(0, POEMS_MAX);
  if (Object.keys(out).length) await put(out);
  return loadSettings();
}

/** The password given at the door: the cookie to set when it is right, else null. */
export async function check(slug: string, password: string): Promise<{ value: string; maxAge: number } | null> {
  const { kv } = await rows();
  const word = cleanSlug(kv.slug);
  if (!word || word !== cleanSlug(slug) || !kv.password) return null;
  if (!matches(String(password ?? "").slice(0, PASSWORD_MAX), kv.password)) return null;
  return { value: sign(word, Number(kv.version) || 0), maxAge: KHATEEB.cookieDays * 86400 };
}

// ───────────────────────────── the cookie ─────────────────────────────

const secret = () => process.env.JAWAD_WEBHOOK_SECRET || createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update("khateeb-door").digest("hex");
const sign = (slug: string, version: number) => `${version}.${createHmac("sha256", secret()).update(`${slug}:${version}`).digest("hex").slice(0, 40)}`;

/** Did this device give the password for the link's word as it stands now? */
export async function doorOpen(slug: string): Promise<boolean> {
  const word = cleanSlug(slug);
  if (!word) return false;
  const got = (await cookies()).get(KHATEEB.cookie)?.value ?? "";
  if (!got) return false;
  const { kv } = await rows();
  if (!kv.password || cleanSlug(kv.slug) !== word) return false;
  const want = sign(word, Number(kv.version) || 0);
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** For the branch's own API calls (the cookie alone, whatever the link's word is now): is the door open on this device? */
export async function anyDoorOpen(): Promise<boolean> {
  const got = (await cookies()).get(KHATEEB.cookie)?.value ?? "";
  if (!got) return false;
  const { kv } = await rows();
  const word = cleanSlug(kv.slug);
  if (!word || !kv.password) return false;
  const want = sign(word, Number(kv.version) || 0);
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
