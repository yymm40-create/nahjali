import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { visitPath } from "@config/stats";

export const dynamic = "force-dynamic";

/** A page of the site was opened (the owner's statistics, /admin/stats): the visitor's random id, the page, the account if any. */
export async function POST(req: Request) {
  const b = (await req.text().then((t) => JSON.parse(t)).catch(() => ({}))) as { path?: unknown; visitor?: unknown };
  const path = visitPath(b.path);
  const visitor = typeof b.visitor === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.visitor) ? b.visitor : null;
  if (!path || !visitor) return NextResponse.json({ ok: false });
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    await createAdminClient().from("site_visits").insert({ visitor, path, user_id: user?.id ?? null });
  } catch {
    /* the table may not be there yet (0051): nothing is counted */
  }
  return NextResponse.json({ ok: true });
}
