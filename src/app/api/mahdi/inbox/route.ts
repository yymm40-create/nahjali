import { NextResponse } from "next/server";
import { check, mahdiRoute, readJson, requireProfile, requireId } from "@/lib/mahdi/server/api";
import { missingTable } from "@/lib/mahdi/server/inbox";

const PAGE = 60;

/**
 * The bell. `?count=1`: only how many are unread (the badge in the top bar, asked every minute).
 * Otherwise the newest notifications. Before migration 0018 runs there are none (`ready: false`).
 */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const unread = await supabase.from("mahdi_inbox").select("id", { count: "exact", head: true }).is("read_at", null);
  if (unread.error) {
    if (missingTable(unread.error)) return NextResponse.json({ ready: false, unread: 0, items: [] });
    throw unread.error;
  }
  if (new URL(req.url).searchParams.get("count")) return NextResponse.json({ ready: true, unread: unread.count ?? 0 });
  const rows = check(await supabase.from("mahdi_inbox").select("id, kind, title, body, url, created_at, read_at").order("created_at", { ascending: false }).limit(PAGE));
  return NextResponse.json({
    ready: true,
    unread: unread.count ?? 0,
    items: (rows ?? []).map((r) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, url: r.url, createdAt: r.created_at, read: Boolean(r.read_at) })),
  });
});

/** `{ read: "all" }` or `{ read: id }` marks as read; `{ delete: id }` removes one. Only my own (RLS). */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const body = await readJson(req);
  const now = new Date().toISOString();
  if (body.read === "all") check(await supabase.from("mahdi_inbox").update({ read_at: now }).is("read_at", null));
  else if (body.read !== undefined) check(await supabase.from("mahdi_inbox").update({ read_at: now }).eq("id", requireId(body.read)).is("read_at", null));
  else if (body.delete !== undefined) check(await supabase.from("mahdi_inbox").delete().eq("id", requireId(body.delete)));
  return NextResponse.json({ ok: true });
});
