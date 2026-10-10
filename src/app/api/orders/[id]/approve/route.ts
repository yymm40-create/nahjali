import { NextResponse } from "next/server";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimOrder, deleteSourcePhoto, setOrderStatus } from "@/lib/orders";
import { templateFor } from "@/lib/tables-booklet/server";

/** Approves one generated character and queues all template poses for generation. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);
  if (order.status !== "awaiting_approval") throw new UserError(MESSAGES.wrongStep, 409);

  const { characterId } = (await req.json().catch(() => ({}))) as { characterId?: string };
  const db = createAdminClient();
  const { data: character } = await db
    .from("characters")
    .select("*")
    .eq("id", characterId ?? "")
    .eq("order_id", order.id)
    .maybeSingle();
  if (!character?.base_image_path) throw new UserError("اختر شخصية صحيحة.", 400);

  const template = await templateFor(order);
  if (!template) throw new Error(`Template not found: ${order.template_id}`);

  // Lock the order first so a double-click can't approve twice
  const claimed = await claimOrder(order.id, ["awaiting_approval"], "generating_poses");
  if (!claimed) throw new UserError(MESSAGES.busy, 409);

  try {
    const { error: e1 } = await db.from("characters").update({ is_approved: true }).eq("id", character.id);
    if (e1) throw e1;
    const { error: e2 } = await db
      .from("poses")
      .upsert(
        template.poses.map((pose_key) => ({ character_id: character.id, pose_key })),
        { onConflict: "character_id,pose_key", ignoreDuplicates: true },
      );
    if (e2) throw e2;
  } catch (err) {
    await setOrderStatus(order.id, "awaiting_approval");
    throw err;
  }

  // Privacy promise: the original photo is deleted as soon as the character is approved
  await deleteSourcePhoto(order);

  return NextResponse.json({ ok: true });
});
