// SERVER ONLY. Who may call the timers' routes (the «لأجل المهدي» dispatcher, «الذكاء الإسلامي» reading): Supabase pg_cron,
// with `Authorization: Bearer <secret>`. The secret is MAHDI_CRON_SECRET on the hosting when it is set; otherwise the one
// kept in Supabase Vault, asked through mahdi_cron_ok (SQL 0127) — so nothing has to be copied by hand (the owner,
// 24 November 2026: the hosting never had it, and every reminder got 404).
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export async function cronAuthorized(req: Request): Promise<boolean> {
  const given = req.headers.get("authorization") ?? "";
  if (!given.startsWith("Bearer ")) return false;
  const token = given.slice(7);
  if (token.length < 24) return false;
  const env = process.env.MAHDI_CRON_SECRET;
  if (env && env.length >= 24) {
    const a = Buffer.from(token);
    const b = Buffer.from(env);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  const { data, error } = await createAdminClient().rpc("mahdi_cron_ok", { p_token: token });
  return !error && data === true;
}
