import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanSave } from "@config/games-build";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f-]{36}$/i;

async function who() {
  const { data } = await (await createClient()).auth.getUser().catch(() => ({ data: { user: null } }));
  return data.user;
}

/** A player's saved progress in a game (their site account), and whether they are signed in. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await who();
  if (!user || !UUID.test(id)) return NextResponse.json({ signedIn: !!user, email: user?.email ?? null, data: null });
  const { data } = await createAdminClient().from("game_saves").select("data").eq("user_id", user.id).eq("game_id", id).maybeSingle();
  return NextResponse.json({ signedIn: true, email: user.email ?? null, data: data?.data ?? null });
}

/** The game saved (what it keeps, as its own storage: keys and texts), on the player's account. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await who();
  if (!user) return NextResponse.json({ error: "سجّل دخول لحفظ تقدمك" }, { status: 401 });
  if (!UUID.test(id)) return NextResponse.json({ error: "لعبة غير صحيحة" }, { status: 400 });
  const b = (await req.json().catch(() => ({}))) as { data?: unknown };
  const data = cleanSave(b.data);
  const { error } = await createAdminClient().from("game_saves").upsert({ user_id: user.id, game_id: id, data, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ error: "ما انحفظ التقدم (هل انشغلت هجرة 0079؟)" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
