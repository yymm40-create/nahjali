import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requireOwner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
}

/**
 * Owner-only film settings:
 *   { action: "invite", email } · { action: "remove", email }
 */
export const POST = handle(async (req: Request) => {
  await requireOwner();
  const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string };
  const db = createAdminClient();

  if (body.action === "invite" || body.action === "remove") {
    const email = (body.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) throw new UserError("اكتب إيميل صحيح.", 400);
    const { error } =
      body.action === "invite"
        ? await db.from("film_allowed_emails").upsert({ email }, { onConflict: "email", ignoreDuplicates: true })
        : await db.from("film_allowed_emails").delete().eq("email", email);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  }

  throw new UserError("طلب غير معروف.", 400);
});
