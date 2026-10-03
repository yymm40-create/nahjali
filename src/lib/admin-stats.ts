import { createAdminClient } from "@/lib/supabase/admin";
import type { Order } from "@/lib/types";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  orders: number;
  ready: number;
  lastOrderAt: string | null;
  dailyTrials: number | null;
}

export interface FeedbackRow {
  id: string;
  email: string;
  rating: number;
  message: string | null;
  createdAt: string;
}

const DAY_MS = 24 * 3600_000;
/** YYYY-MM-DD in Riyadh time */
export const riyadhDay = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600_000).toISOString().slice(0, 10);

/** Everything the owner's dashboard shows, read with the service role (server only). */
export async function loadAdminStats() {
  const db = createAdminClient();
  const [{ data: authData }, { data: orders }, { data: feedback }, { data: logs }, { data: characters }] = await Promise.all([
    db.auth.admin.listUsers({ perPage: 1000 }),
    db.from("orders").select("*").order("created_at", { ascending: false }),
    db.from("feedback").select("*").order("created_at", { ascending: false }),
    db.from("generation_logs").select("estimated_cost_usd,success,created_at"),
    db.from("characters").select("order_id,base_image_path,is_approved"),
  ]);
  const allOrders = (orders ?? []) as Order[];
  const authUsers = authData?.users ?? [];
  const emailOf = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));

  const users: AdminUser[] = authUsers
    .map((u) => {
      const mine = allOrders.filter((o) => o.user_id === u.id);
      return {
        id: u.id,
        email: u.email ?? "",
        name: (u.user_metadata?.full_name as string) ?? (u.user_metadata?.name as string) ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        orders: mine.length,
        ready: mine.filter((o) => o.status === "ready").length,
        lastOrderAt: mine[0]?.created_at ?? null,
        dailyTrials: Number(u.app_metadata?.daily_trials) || null,
      };
    })
    .sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));

  const ordersWithCharacter = new Set((characters ?? []).filter((c) => c.base_image_path).map((c) => c.order_id));
  const approved = new Set((characters ?? []).filter((c) => c.is_approved).map((c) => c.order_id));
  const feedbackRows: FeedbackRow[] = (feedback ?? []).map((f) => ({
    id: f.id,
    email: emailOf.get(f.user_id) ?? "",
    rating: f.rating,
    message: f.message,
    createdAt: f.created_at,
  }));

  const usersWithOrders = new Set(allOrders.map((o) => o.user_id));
  const usersWithReady = new Set(allOrders.filter((o) => o.status === "ready").map((o) => o.user_id));
  const usersWithFeedback = new Set((feedback ?? []).map((f) => f.user_id));
  const usersWithCharacter = new Set(allOrders.filter((o) => ordersWithCharacter.has(o.id)).map((o) => o.user_id));
  const usersApproved = new Set(allOrders.filter((o) => approved.has(o.id)).map((o) => o.user_id));

  const readyCount = allOrders.filter((o) => o.status === "ready").length;
  const cost = (logs ?? []).reduce((s, l) => s + Number(l.estimated_cost_usd), 0);
  const ratings = feedbackRows.map((f) => f.rating);

  // Last 14 days (Riyadh), oldest first
  const today = riyadhDay(new Date().toISOString());
  const days = Array.from({ length: 14 }, (_, i) => riyadhDay(new Date(Date.parse(today) - (13 - i) * DAY_MS).toISOString()));
  const countBy = (dates: string[]) => days.map((d) => ({ day: d, value: dates.filter((x) => riyadhDay(x) === d).length }));

  const breakdown = (key: "style" | "quality" | "child_gender") => {
    const m = new Map<string, number>();
    for (const o of allOrders) m.set(String(o[key] ?? "—"), (m.get(String(o[key] ?? "—")) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  // Distinct people whose latest sign-in falls in each window (Riyadh days; week = last 7 days, month = last 30)
  const todayStr = riyadhDay(new Date().toISOString());
  const dayIdx = (iso: string) => Math.round((Date.parse(todayStr) - Date.parse(riyadhDay(iso))) / DAY_MS);
  const signIns = authUsers.filter((u) => u.last_sign_in_at).map((u) => dayIdx(u.last_sign_in_at as string));
  const logins = {
    today: signIns.filter((d) => d === 0).length,
    yesterday: signIns.filter((d) => d === 1).length,
    week: signIns.filter((d) => d <= 6).length,
    month: signIns.filter((d) => d <= 29).length,
  };

  return {
    logins,
    kpis: {
      signups: authUsers.length,
      triedUsers: usersWithOrders.size,
      orders: allOrders.length,
      ready: readyCount,
      completion: allOrders.length ? readyCount / allOrders.length : 0,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      feedbackCount: ratings.length,
      costUsd: cost,
      costPerBooklet: readyCount ? cost / readyCount : null,
    },
    funnel: [
      { label: "سجّلوا دخول", value: authUsers.length },
      { label: "بدأوا طلب", value: usersWithOrders.size },
      { label: "طلعت لهم شخصية", value: usersWithCharacter.size },
      { label: "اعتمدوا الشخصية", value: usersApproved.size },
      { label: "حمّلوا كتيب", value: usersWithReady.size },
      { label: "أعطوا رأيهم", value: usersWithFeedback.size },
    ],
    dailyOrders: countBy(allOrders.map((o) => o.created_at)),
    dailySignups: countBy(authUsers.map((u) => u.created_at)),
    styles: breakdown("style"),
    qualities: breakdown("quality"),
    genders: breakdown("child_gender"),
    statuses: (() => {
      const m = new Map<string, number>();
      for (const o of allOrders) m.set(o.status, (m.get(o.status) ?? 0) + 1);
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    })(),
    users,
    feedback: feedbackRows,
    recentOrders: allOrders.slice(0, 30).map((o) => ({ ...o, email: emailOf.get(o.user_id) ?? "" })),
  };
}
