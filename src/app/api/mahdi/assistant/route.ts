import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { missingTable, notify, ownerIds } from "@/lib/mahdi/server/inbox";
import { cleanText } from "@/lib/mahdi/server/validate";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX = 2000;
const PER_DAY = 20;
const A = t.assistant;

/** My conversation with «المساعد». Opening it marks the team's replies (and their notifications) as read. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const { data, error } = await supabase.from("mahdi_assistant_messages").select("id, from_owner, body, created_at, read_at").order("created_at").limit(300);
  if (error) {
    if (missingTable(error)) return NextResponse.json({ ready: false, messages: [] });
    throw error;
  }
  const rows = data ?? [];
  if (rows.some((m) => m.from_owner && !m.read_at)) {
    const now = new Date().toISOString();
    const db = createAdminClient();
    await Promise.all([
      db.from("mahdi_assistant_messages").update({ read_at: now }).eq("user_id", user.id).eq("from_owner", true).is("read_at", null),
      supabase.from("mahdi_inbox").update({ read_at: now }).eq("kind", "assistant_reply").is("read_at", null),
    ]);
  }
  return NextResponse.json({
    ready: true,
    messages: rows.map((m) => ({ id: m.id, fromTeam: m.from_owner, body: m.body, createdAt: m.created_at, read: Boolean(m.read_at) })),
  });
});

/** Sends a question `{ body }`. The owner gets a notification; the answer comes from a person, never automatically. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user, profile } = await requireProfile(req);
  const raw = await readJson(req);
  if (typeof raw.body === "string" && raw.body.trim().length > MAX) throw new UserError(A.tooLong(MAX), 400);
  const body = cleanText(raw.body, MAX);
  if (!body) throw new UserError(t.errors.invalid, 400);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const today = await supabase.from("mahdi_assistant_messages").select("id", { count: "exact", head: true }).eq("from_owner", false).gte("created_at", since);
  if (today.error) {
    if (missingTable(today.error)) throw new UserError(A.notReady, 503);
    throw today.error;
  }
  if ((today.count ?? 0) >= PER_DAY) throw new UserError(A.tooMany, 429);
  const row = check(await supabase.from("mahdi_assistant_messages").insert({ user_id: user.id, body }).select("id, created_at").single()) as { id: string; created_at: string };
  await notify(await ownerIds(), { kind: "assistant_message", title: A.newTitle(profile.displayName), body, url: `/admin/mahdi/assistant?u=${user.id}` });
  return NextResponse.json({ message: { id: row.id, fromTeam: false, body, createdAt: row.created_at, read: false } });
});
