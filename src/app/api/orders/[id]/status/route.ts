import { NextResponse } from "next/server";
import { getOwnedOrder, handle, requireApiUser } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { getApprovedCharacter } from "@/lib/orders";

/** Lightweight status for the progress page. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);

  let poses = { total: 0, done: 0, failed: 0 };
  const character = await getApprovedCharacter(order.id);
  if (character) {
    const { data } = await createAdminClient().from("poses").select("status").eq("character_id", character.id);
    const list = data ?? [];
    poses = {
      total: list.length,
      done: list.filter((p) => p.status === "done").length,
      failed: list.filter((p) => p.status === "failed").length,
    };
  }

  return NextResponse.json({ status: order.status, poses }, { headers: { "Cache-Control": "no-store" } });
});
