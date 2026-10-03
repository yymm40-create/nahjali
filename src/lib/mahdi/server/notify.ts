// SERVER ONLY. Web Push: sending, and the dispatcher that decides who gets a reminder right now.
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { alreadySent, buildTimeline, dayGoals, dueSlot, inQuietHours, minuteOfDayIn, reminderSlots, todayIn, toMinutes, addDays, type ReminderMode } from "../engine";
import { t } from "../i18n";
import { toItems } from "../client/derive";
import { addChallenges, chunks, loadHabitData } from "./bulk";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

let configured = false;
/** VAPID keys come from the environment (see scripts/generate-mahdi-vapid.mts). False when they are not set up. */
export function pushConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subject) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface SubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  failures: number;
}

/** "ok", "gone" (the device unsubscribed: delete it) or "failed" (try again next time). */
export async function sendPush(sub: Pick<SubRow, "endpoint" | "p256dh" | "auth">, payload: PushPayload): Promise<"ok" | "gone" | "failed"> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: "normal" });
    return "ok";
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
}

/** Sends to every device of a user and tidies the subscription list. Returns how many devices received it. */
export async function pushToUser(db: SupabaseClient, subs: SubRow[], payload: PushPayload): Promise<number> {
  let sent = 0;
  for (const s of subs) {
    const r = await sendPush(s, payload);
    if (r === "ok") {
      sent++;
      if (s.failures > 0) await db.from("mahdi_push_subscriptions").update({ failures: 0 }).eq("id", s.id);
    } else if (r === "gone" || s.failures + 1 >= 5) {
      await db.from("mahdi_push_subscriptions").delete().eq("id", s.id);
    } else {
      await db.from("mahdi_push_subscriptions").update({ failures: s.failures + 1 }).eq("id", s.id);
    }
  }
  return sent;
}

interface SettingsRow {
  user_id: string;
  mode: ReminderMode;
  times: string[];
  quiet_start: string;
  quiet_end: string;
  habit_reminders: boolean;
  last_sent_at: string | null;
}

export interface DispatchResult {
  checked: number;
  due: number;
  sent: number;
  skippedComplete: number;
}

/**
 * Runs every 15 minutes. For each user with reminders on: is a slot due now (in their time zone, outside quiet hours,
 * not already sent)? If so, and the day still has unfinished goals, send one notification to their devices.
 * A habit's own reminder time sends «حان وقت …» instead of the general text (never both at once).
 */
export async function dispatchReminders(db: SupabaseClient, now: Date = new Date()): Promise<DispatchResult> {
  const result: DispatchResult = { checked: 0, due: 0, sent: 0, skippedComplete: 0 };
  const { data: settings, error } = await db
    .from("mahdi_notification_settings")
    .select("user_id, mode, times, quiet_start, quiet_end, habit_reminders, last_sent_at")
    .neq("mode", "off");
  if (error) throw error;
  const rows = (settings ?? []) as SettingsRow[];
  result.checked = rows.length;
  if (!rows.length) return result;

  const tzOf = new Map<string, string>();
  const subsOf = new Map<string, SubRow[]>();
  for (const ids of chunks(rows.map((r) => r.user_id))) {
    const [pr, subs] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, time_zone").in("user_id", ids),
      db.from("mahdi_push_subscriptions").select("id, user_id, endpoint, p256dh, auth, failures").in("user_id", ids),
    ]);
    for (const p of pr.data ?? []) tzOf.set(p.user_id, p.time_zone);
    for (const s of (subs.data ?? []) as SubRow[]) (subsOf.get(s.user_id) ?? subsOf.set(s.user_id, []).get(s.user_id)!).push(s);
  }

  // Cheap checks first (time zone maths only), so users with nothing due never cost a database read
  const candidates = rows.filter((r) => subsOf.has(r.user_id) && tzOf.has(r.user_id)).map((r) => {
    const tz = tzOf.get(r.user_id)!;
    const nowMin = minuteOfDayIn(tz, now);
    const quiet = (m: number) => inQuietHours(m, r.quiet_start, r.quiet_end);
    const general = dueSlot(nowMin, reminderSlots(r.mode, r.times).filter((m) => !quiet(m)));
    return { r, tz, nowMin, quiet, general: general && !alreadySent(r.last_sent_at, general.ago, now) ? general : null };
  });

  // Habits with their own reminder time, for users who want them
  const habitsDue = new Map<string, { habitId: string; name: string; ago: number }[]>();
  const wantHabits = candidates.filter((c) => c.r.habit_reminders).map((c) => c.r.user_id);
  for (const ids of chunks(wantHabits)) {
    const { data } = await db.from("mahdi_habits").select("id, user_id, name, reminder_time").in("user_id", ids).not("reminder_time", "is", null);
    for (const h of data ?? []) {
      const c = candidates.find((x) => x.r.user_id === h.user_id)!;
      const slot = toMinutes(h.reminder_time);
      if (slot === null || c.quiet(slot)) continue;
      const due = dueSlot(c.nowMin, [slot]);
      if (!due || alreadySent(c.r.last_sent_at, due.ago, now)) continue;
      (habitsDue.get(h.user_id) ?? habitsDue.set(h.user_id, []).get(h.user_id)!).push({ habitId: h.id, name: h.name, ago: due.ago });
    }
  }

  const due = candidates.filter((c) => c.general || habitsDue.has(c.r.user_id));
  result.due = due.length;
  if (!due.length) return result;

  const earliest = addDays(todayIn("Etc/GMT+12", now), -2);
  const data = await loadHabitData(db, due.map((c) => c.r.user_id), earliest);
  await addChallenges(db, data, earliest);

  for (const batch of chunks(due, 10)) {
    await Promise.all(
      batch.map(async (c) => {
        const d = data.get(c.r.user_id)!;
        const today = todayIn(c.tz, now);
        const tl = buildTimeline(toItems(d.habits, d.logs), today, today, { asOf: today, weekStart: 6 });
        const open = dayGoals(tl, today).filter((i) => i.progress < 1);
        if (open.length === 0) {
          result.skippedComplete++; // the day is complete (or has nothing due): no reminder
          return;
        }
        const mine = (habitsDue.get(c.r.user_id) ?? []).filter((h) => open.some((i) => i.itemId === h.habitId));
        let payload: PushPayload | null = null;
        if (mine.length > 0) payload = { title: t.notify.title2, body: t.notify.habitBody(mine.map((h) => h.name)), url: "/mahdi", tag: "mahdi-habit" };
        else if (c.general) payload = { title: t.notify.title2, body: t.notify.body, url: "/mahdi", tag: "mahdi-daily" };
        if (!payload) return; // only habit reminders were due and none of those habits is still open
        const n = await pushToUser(db, subsOf.get(c.r.user_id)!, payload);
        if (n > 0) {
          result.sent++;
          await db.from("mahdi_notification_settings").update({ last_sent_at: now.toISOString() }).eq("user_id", c.r.user_id);
        }
      }),
    );
  }
  return result;
}
