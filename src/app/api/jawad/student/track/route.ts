import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** «الطالب الذكي» · one page visit (signed in or not), for the owner's statistics. Never fails the page. */
export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { visitor?: unknown; path?: unknown };
    const visitor = String(b.visitor ?? "");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(visitor)) return NextResponse.json({ ok: false });
    const path = String(b.path ?? "").slice(0, 200);
    if (!path.startsWith("/jawad-ai/student")) return NextResponse.json({ ok: false });
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    // one row per visitor and page every 10 minutes (reloads and floods don't fill the statistics)
    const db = createAdminClient();
    const { count } = await db
      .from("student_visits")
      .select("id", { count: "exact", head: true })
      .eq("visitor", visitor)
      .eq("path", path)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
    if (count) return NextResponse.json({ ok: true });
    await db.from("student_visits").insert({ user_id: user?.id ?? null, visitor, path });
  } catch {
    // statistics only
  }
  return NextResponse.json({ ok: true });
}
