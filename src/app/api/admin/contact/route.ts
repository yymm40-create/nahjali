import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";
import { waLink } from "@/lib/phone";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Found {
  phone: string;
  name: string;
  source: string;
  at: string;
  wa: string | null;
}

/**
 * Owners only — «رقم الشخص»: the phone a person left on the site, by their email. The site asks for a phone only on its
 * orders (the course, a top-up of balance), so that is where it is looked for: `{ email }` → `{ found: [...] }`.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) throw new UserError("اكتب الإيميل كامل وصحيح.", 400);
  const db = createAdminClient();
  // the same email whatever its letters' case (the pattern's own wildcards are escaped)
  const exact = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const [course, credit] = await Promise.all([
    db.from("course_orders").select("phone,name,created_at").ilike("email", exact).neq("phone", "").order("created_at", { ascending: false }).limit(20),
    db.from("credit_orders").select("phone,name,created_at").ilike("email", exact).neq("phone", "").order("created_at", { ascending: false }).limit(20),
  ]);
  const rows = [
    ...(course.data ?? []).map((r) => ({ ...r, source: "طلب الدورة" })),
    ...(credit.data ?? []).map((r) => ({ ...r, source: "طلب شحن رصيد" })),
  ].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  const seen = new Set<string>();
  const found: Found[] = [];
  for (const r of rows) {
    const phone = String(r.phone ?? "").trim();
    const key = phone.replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push({ phone, name: String(r.name ?? ""), source: r.source, at: String(r.created_at), wa: waLink(phone) });
  }
  return NextResponse.json({ email, found, searched: ["course_orders", "credit_orders"], errors: [course.error, credit.error].filter(Boolean).length });
});
