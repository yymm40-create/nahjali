import { createClient } from "@/lib/supabase/server";
import { loadAdminStats } from "@/lib/admin-stats";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** CSV of all users (owner only), opens in Excel / Google Sheets. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user.email)) return new Response("Not found", { status: 404 });

  const { users, feedback } = await loadAdminStats();
  const lastRating = new Map<string, number>();
  for (const f of [...feedback].reverse()) lastRating.set(f.email, f.rating);

  const rows = [
    ["email", "name", "signed_up", "last_sign_in", "orders", "ready_booklets", "last_order", "last_rating"],
    ...users.map((u) => [u.email, u.name, u.createdAt, u.lastSignInAt, u.orders, u.ready, u.lastOrderAt, lastRating.get(u.email) ?? ""]),
  ];
  // BOM so Excel opens Arabic names correctly
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nahjali-users-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
