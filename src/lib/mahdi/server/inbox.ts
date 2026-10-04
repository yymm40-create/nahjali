// SERVER ONLY. The notifications inbox (the bell) and «المساعد»: writing notifications, with a push to the person's
// devices when push is set up, and finding the owner's accounts.
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_EMAILS } from "@config/site";
import { pushConfigured, pushToUser, type SubRow } from "./notify";

export interface InboxNote {
  kind: string;
  title: string;
  body?: string;
  /** A path inside the site, opened when the notification is tapped. */
  url?: string;
}

/** True when the error says the table of migration 0018 is not there yet. */
export const missingTable = (error: unknown) => {
  const code = (error as { code?: string } | null)?.code;
  return code === "42P01" || code === "PGRST205" || code === "PGRST202" || code === "42883";
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Adds a notification to each person's inbox and pushes it to their devices. Never throws (a notification is a bonus). */
export async function notify(userIds: string[], note: InboxNote): Promise<void> {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  const db = createAdminClient();
  const row = { kind: note.kind, title: clip(note.title, 120), body: clip(note.body ?? "", 400), url: note.url ?? "" };
  const { error } = await db.from("mahdi_inbox").insert(ids.map((user_id) => ({ user_id, ...row })));
  if (error) {
    if (!missingTable(error)) console.error("[mahdi] inbox", error);
    return;
  }
  if (!pushConfigured()) return;
  try {
    const { data } = await db.from("mahdi_push_subscriptions").select("id, user_id, endpoint, p256dh, auth, failures").in("user_id", ids);
    for (const id of ids) {
      const subs = ((data ?? []) as SubRow[]).filter((s) => s.user_id === id);
      // The app's service worker opens pages of the app only; anything else is reached from the inbox
      if (subs.length) await pushToUser(db, subs, { title: row.title, body: row.body, url: row.url.startsWith("/mahdi") ? row.url : "/mahdi/inbox", tag: `inbox-${note.kind}` });
    }
  } catch (err) {
    console.error("[mahdi] inbox push", err);
  }
}

let owners: { ids: string[]; at: number } | null = null;
/** The owner's account ids (from the owner e-mails), remembered for ten minutes. */
export async function ownerIds(): Promise<string[]> {
  if (owners && Date.now() - owners.at < 10 * 60_000) return owners.ids;
  const { data, error } = await createAdminClient().rpc("mahdi_user_ids_by_email", { p_emails: ADMIN_EMAILS });
  if (error) {
    if (!missingTable(error)) console.error("[mahdi] owner ids", error);
    return [];
  }
  const ids = ((data ?? []) as unknown[]).map((x) => (typeof x === "string" ? x : String((x as Record<string, unknown>).mahdi_user_ids_by_email ?? ""))).filter(Boolean);
  owners = { ids, at: Date.now() };
  return ids;
}
