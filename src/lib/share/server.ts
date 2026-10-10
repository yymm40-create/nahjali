// «انشرنا واربح» on the server: the owner's switch and reward, a person's claim («نشرت ✅»), the Telegram message to
// the owner with «✅ أكّد» / «❌ ارفض», and the reward added to the wallet once. Server only.

import { UserError } from "@/lib/api";
import { grantCoins } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { esc, ownerChat, telegramFull, tgSend } from "@/lib/course/telegram";
import { cleanHandle, instagramUrl, SHARE, type ShareStatus } from "@config/share";

const db = () => createAdminClient();
const missing = (e: { code?: string; message?: string } | null) => !!e && (e.code === "42P01" || e.code === "PGRST205" || /relation .* does not exist|Could not find the table/i.test(e.message ?? ""));
export const NOT_READY = "«انشرنا واربح» ما تجهّز بعد: شغّل ملف SQL رقم 0053 في Supabase.";

export interface ShareSettings {
  enabled: boolean;
  rewardSar: number;
}

export interface Claim {
  id: string;
  userId: string;
  email: string | null;
  handle: string;
  status: ShareStatus;
  rewardHalalas: number;
  creditedAt: string | null;
  createdAt: string;
}

const view = (r: Record<string, unknown>): Claim => ({
  id: r.id as string,
  userId: r.user_id as string,
  email: (r.email as string | null) ?? null,
  handle: String(r.handle ?? ""),
  status: (r.status as ShareStatus) ?? "pending",
  rewardHalalas: Number(r.reward_halalas ?? 0),
  creditedAt: (r.credited_at as string | null) ?? null,
  createdAt: String(r.created_at ?? ""),
});

export async function shareSettings(): Promise<ShareSettings & { ready: boolean }> {
  const { data, error } = await db().from("share_kv").select("key,value");
  if (error) return { enabled: false, rewardSar: SHARE.defaultRewardSar, ready: !missing(error) };
  const kv = Object.fromEntries((data ?? []).map((r) => [r.key as string, String(r.value)]));
  const reward = Number(kv.reward);
  return { enabled: kv.enabled !== "off", rewardSar: Number.isFinite(reward) && reward > 0 ? reward : SHARE.defaultRewardSar, ready: true };
}

export async function saveShareSettings(s: Partial<ShareSettings>) {
  const rows: { key: string; value: string; updated_at: string }[] = [];
  const at = new Date().toISOString();
  if (s.enabled !== undefined) rows.push({ key: "enabled", value: s.enabled ? "on" : "off", updated_at: at });
  if (s.rewardSar !== undefined) {
    const n = Math.round(Number(s.rewardSar) * 100) / 100;
    if (!Number.isFinite(n) || n <= 0 || n > 1000) throw new UserError("المكافأة بين ٠٫٠١ و١٠٠٠ ريال.");
    rows.push({ key: "reward", value: String(n), updated_at: at });
  }
  if (!rows.length) return;
  const { error } = await db().from("share_kv").upsert(rows);
  if (error) throw missing(error) ? new UserError(NOT_READY, 503) : error;
}

/** This person's latest claim (or null). */
export async function myClaim(userId: string): Promise<Claim | null> {
  const { data, error } = await db().from("share_claims").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
  if (error) return null;
  const rows = (data ?? []).map(view);
  return rows.find((c) => c.status === "approved") ?? rows[0] ?? null;
}

const text = (c: Claim, state = "") =>
  [
    state || "📣 <b>«نشرت» — انشرنا واربح</b>",
    `📸 انستغرام: <b>@${esc(c.handle)}</b>`,
    `✉️ ${esc(c.email ?? "")}`,
    `🎁 المكافأة: ${c.rewardHalalas / 100} ريال`,
    ...(state ? [] : [`تأكد إن عنده ستوري فيه منشن لـ @${SHARE.account}، وبعدين اضغط أكّد.`]),
  ].join("\n");

export const claimButtons = (c: Claim, done: boolean): unknown[][] => [
  ...(done ? [] : [[{ text: "✅ أكّد وأعطه المكافأة", callback_data: `sok:${c.id}` }, { text: "❌ ارفض", callback_data: `sno:${c.id}` }]]),
  [{ text: "📸 افتح حسابه", url: instagramUrl(c.handle) }],
];
export { text as claimText };

/** «نشرت ✅»: a pending claim with their Instagram name, and a message to the owner. */
export async function claim(user: { id: string; email?: string | null }, rawHandle: unknown): Promise<{ claim: Claim; told: boolean }> {
  const s = await shareSettings();
  if (!s.ready) throw new UserError(NOT_READY, 503);
  if (!s.enabled) throw new UserError("هذا العرض متوقف الحين.", 409);
  const handle = cleanHandle(rawHandle);
  if (!handle) throw new UserError("اكتب اسم حسابك في انستغرام صحيح (مثل ali.design).");
  if (handle === SHARE.account) throw new UserError("اكتب اسم حسابك أنت، مو حسابنا 🙂");
  const before = await myClaim(user.id);
  if (before?.status === "approved") throw new UserError("أخذت مكافأة النشر من قبل ✅ شكرًا لك!", 409);
  if (before?.status === "pending") {
    // the same press again (or a corrected name): the waiting claim is updated, not doubled
    const { data, error } = await db().from("share_claims").update({ handle }).eq("id", before.id).eq("status", "pending").select("*").single();
    if (error) throw error;
    return { claim: view(data), told: false };
  }
  const { data, error } = await db().from("share_claims").insert({ user_id: user.id, email: user.email?.toLowerCase() ?? null, handle, reward_halalas: Math.round(s.rewardSar * 100) }).select("*").single();
  if (error) throw missing(error) ? new UserError(NOT_READY, 503) : error;
  const c = view(data);
  let told = false;
  if (telegramFull()) {
    try {
      await tgSend(ownerChat(), text(c), claimButtons(c, false));
      told = true;
    } catch (e) {
      console.error("share telegram", e);
    }
  }
  return { claim: c, told };
}

export async function getClaim(id: string): Promise<Claim | null> {
  const { data } = await db().from("share_claims").select("*").eq("id", id).maybeSingle();
  return data ? view(data) : null;
}

/** The owner saw the story: approved and the reward added (once, even if pressed twice). */
export async function approveClaim(id: string, by: string): Promise<{ claim: Claim; already: boolean }> {
  const at = new Date().toISOString();
  const { data, error } = await db().from("share_claims").update({ status: "approved", decided_by: by.slice(0, 120), decided_at: at }).eq("id", id).in("status", ["pending", "rejected"]).select("*").maybeSingle();
  if (error) {
    // the unique index: this person already has an approved claim
    if (error.code === "23505") throw new UserError("هذا الشخص أخذ المكافأة من قبل.", 409);
    throw error;
  }
  const cur = data ? view(data) : await getClaim(id);
  if (!cur) throw new UserError("ما لقينا الطلب.", 404);
  if (cur.status !== "approved") throw new UserError("هذا الطلب ما عاد قابل للتأكيد.", 409);
  if (cur.creditedAt) return { claim: cur, already: true };
  const { data: marked } = await db().from("share_claims").update({ credited_at: at }).eq("id", id).is("credited_at", null).select("*").maybeSingle();
  if (!marked) return { claim: cur, already: true };
  try {
    await grantCoins(cur.userId, cur.rewardHalalas, `مكافأة النشر في انستغرام (@${cur.handle})`);
  } catch (e) {
    await db().from("share_claims").update({ credited_at: null }).eq("id", id);
    throw e;
  }
  return { claim: view(marked), already: false };
}

export async function rejectClaim(id: string, by: string): Promise<Claim> {
  const { data, error } = await db().from("share_claims").update({ status: "rejected", decided_by: by.slice(0, 120), decided_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("*").maybeSingle();
  if (error) throw error;
  if (!data) throw new UserError("هذا الطلب ما عاد قابل للرفض.", 409);
  return view(data);
}

export async function listClaims(status?: ShareStatus): Promise<Claim[]> {
  let q = db().from("share_claims").select("*").order("created_at", { ascending: false }).limit(300);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []).map(view);
}
