// SERVER ONLY. «تنبيهات تجيبك للتطبيق»: the dispatcher of the notifications that bring people back (آية ورواية الصباح، ملاحظة اليوم والأسبوع،
// سلسلتك في خطر، اشتقنالك). It runs inside the 15-minute tick that already sends the habit reminders. For each person with a device:
// which kinds are due now (their own day's hour, outside quiet hours, switched on, allowed today)? Each kind at most once a day and at
// most ENGAGE_DAILY_MAX of them in a day, the most important first; nothing is sent twice because every send is first CLAIMED in
// `mahdi_push_log` (migration 0102; before it, nothing here runs).
import type { SupabaseClient } from "@supabase/supabase-js";
import { CONSISTENCY_THRESHOLD } from "@config/mahdi";
import { addDays, buildTimeline, dayGoals, dayStreak, daysSinceLastActivity, dueSlot, inQuietHours, minuteOfDayIn, toMinutes, todayIn } from "../engine";
import { toItems } from "../client/derive";
import { COMEBACK_AFTER_DAYS, COMEBACK_EVERY_DAYS, ENGAGE, ENGAGE_DAILY_MAX, STREAK_MIN_DAYS, engageDay, engageOn, engageText, parseEngage, weekStartOf, type EngageKind } from "../engage";
import { chunks, loadHabitData } from "./bulk";
import { pushToUser, type SubRow } from "./notify";
import { selectAll } from "./snapshot";

export interface EngageResult {
  checked: number;
  due: number;
  sent: number;
  byKind: Partial<Record<EngageKind, number>>;
}

interface Settings {
  user_id: string;
  quiet_start: string;
  quiet_end: string;
  engage?: unknown;
}

export async function dispatchEngagement(db: SupabaseClient, now: Date = new Date()): Promise<EngageResult> {
  const result: EngageResult = { checked: 0, due: 0, sent: 0, byKind: {} };
  // the people with a device (they allowed notifications), and their devices
  const subs = await selectAll<SubRow>((a, b) => db.from("mahdi_push_subscriptions").select("id, user_id, endpoint, p256dh, auth, failures").order("id").range(a, b));
  const subsOf = new Map<string, SubRow[]>();
  for (const s of subs) (subsOf.get(s.user_id) ?? subsOf.set(s.user_id, []).get(s.user_id)!).push(s);
  const users = [...subsOf.keys()];
  result.checked = users.length;
  if (!users.length) return result;

  const tzOf = new Map<string, { tz: string; weekStart: number }>();
  const setOf = new Map<string, Settings>();
  for (const ids of chunks(users)) {
    const [pr, st] = await Promise.all([
      db.from("mahdi_profiles").select("user_id, time_zone, week_start").in("user_id", ids),
      db.from("mahdi_notification_settings").select("*").in("user_id", ids),
    ]);
    for (const p of pr.data ?? []) tzOf.set(p.user_id, { tz: p.time_zone, weekStart: Number(p.week_start) });
    for (const s of (st.data ?? []) as Settings[]) setOf.set(s.user_id, s);
  }

  // which kinds are due for whom, by clock alone (no database read for people with nothing due)
  const due = new Map<string, { kind: EngageKind; today: string; weekStart: number }[]>();
  for (const u of users) {
    const z = tzOf.get(u);
    if (!z) continue;
    const s = setOf.get(u);
    const engage = parseEngage(s?.engage);
    const nowMin = minuteOfDayIn(z.tz, now);
    const today = todayIn(z.tz, now);
    const quietStart = s?.quiet_start ?? "23:00", quietEnd = s?.quiet_end ?? "07:00";
    const kinds = ENGAGE.filter((e) => {
      const slot = toMinutes(e.at);
      return slot !== null && engageOn(engage, e.id) && !inQuietHours(slot, quietStart, quietEnd) && dueSlot(nowMin, [slot]) !== null && engageDay(e.id, today, z.weekStart);
    })
      .sort((a, b) => a.priority - b.priority)
      .map((e) => ({ kind: e.id, today, weekStart: z.weekStart }));
    if (kinds.length) due.set(u, kinds);
  }
  if (!due.size) return result;
  result.due = due.size;
  const dueUsers = [...due.keys()];

  // what was already sent (a week back, for «اشتقنالك»)
  const sentLog = new Map<string, { kind: string; day: string }[]>();
  const since = addDays(todayIn("Etc/GMT+12", now), -COMEBACK_EVERY_DAYS);
  for (const ids of chunks(dueUsers)) {
    const { data, error } = await db.from("mahdi_push_log").select("user_id, kind, day").in("user_id", ids).gte("day", since);
    if (error) return result; // migration 0102 has not run: nothing here is sent
    for (const r of data ?? []) (sentLog.get(r.user_id) ?? sentLog.set(r.user_id, []).get(r.user_id)!).push({ kind: r.kind, day: r.day });
  }

  // the notes already written (the review notes of migration 0094; without them those two kinds are skipped)
  const notes = new Set<string>();
  let notesReady = true;
  for (const ids of chunks(dueUsers)) {
    const { data, error } = await db.from("mahdi_review_notes").select("user_id, kind, period_start").in("user_id", ids).gte("period_start", addDays(since, -7));
    if (error) {
      notesReady = false;
      break;
    }
    for (const n of data ?? []) notes.add(`${n.user_id}|${n.kind}|${n.period_start}`);
  }

  // habits and logs, only for the people whose due kinds need them (the streak, the comeback)
  const needData = dueUsers.filter((u) => due.get(u)!.some((k) => k.kind === "streak" || k.kind === "comeback"));
  const data = needData.length ? await loadHabitData(db, needData, addDays(todayIn("Etc/GMT+12", now), -45)) : new Map();

  for (const batch of chunks(dueUsers, 10)) {
    await Promise.all(
      batch.map(async (u) => {
        const log = sentLog.get(u) ?? [];
        const today = due.get(u)![0].today;
        let room = ENGAGE_DAILY_MAX - log.filter((l) => l.day === today).length;
        for (const { kind, weekStart } of due.get(u)!) {
          if (room <= 0) break;
          if (log.some((l) => l.kind === kind && l.day === today)) continue;
          let o: { n?: number; left?: number } | null = {};
          if (kind === "review_day") o = notesReady && !notes.has(`${u}|day|${today}`) ? {} : null;
          else if (kind === "review_week") o = notesReady && !notes.has(`${u}|week|${weekStartOf(today, weekStart)}`) ? {} : null;
          else if (kind === "streak" || kind === "comeback") {
            const d = data.get(u);
            if (!d) o = null;
            else {
              const items = toItems(d.habits, d.logs);
              if (kind === "comeback") {
                const away = daysSinceLastActivity(items, today);
                const recent = log.some((l) => l.kind === "comeback");
                o = away !== null && away >= COMEBACK_AFTER_DAYS && !recent ? { n: away } : null;
              } else {
                const tl = buildTimeline(items, addDays(today, -45), today, { asOf: today, weekStart });
                const open = dayGoals(tl, today).filter((i) => i.progress < 1).length;
                const streak = dayStreak(tl, CONSISTENCY_THRESHOLD);
                o = open > 0 && streak.current >= STREAK_MIN_DAYS ? { n: streak.current, left: open } : null;
              }
            }
          }
          if (!o) continue;
          // claim first (a second tick, or a second server, finds the row and sends nothing)
          const claim = await db.from("mahdi_push_log").insert({ user_id: u, kind, day: today });
          if (claim.error) continue;
          room--;
          const n = await pushToUser(db, subsOf.get(u)!, engageText(kind, today, o));
          if (n > 0) {
            result.sent++;
            result.byKind[kind] = (result.byKind[kind] ?? 0) + 1;
          }
        }
      }),
    );
  }
  return result;
}
