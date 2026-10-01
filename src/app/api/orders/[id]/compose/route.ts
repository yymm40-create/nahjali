import { NextResponse } from "next/server";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { claimOrder, getApprovedCharacter, setOrderStatus } from "@/lib/orders";
import { composeBooklet } from "@/lib/compose";
import { getTemplate } from "@/lib/templates";
import type { Pose } from "@/lib/types";

export const maxDuration = 120;

/** Builds the PDF once every pose is done, stores it, and marks the order ready. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);
  if (order.status === "ready") return NextResponse.json({ ok: true });
  if (!["generating_poses", "composing"].includes(order.status)) throw new UserError(MESSAGES.wrongStep, 409);

  const character = await getApprovedCharacter(order.id);
  if (!character) throw new Error("Order has no approved character");
  const db = createAdminClient();
  const poses = ((await db.from("poses").select("*").eq("character_id", character.id)).data ?? []) as Pose[];
  if (poses.length === 0 || poses.some((p) => p.status !== "done" || !p.image_path)) {
    throw new UserError(MESSAGES.wrongStep, 409);
  }

  const claimed = await claimOrder(order.id, ["generating_poses"], "composing");
  if (!claimed) throw new UserError(MESSAGES.busy, 409);

  try {
    const template = await getTemplate(order.template_id);
    if (!template) throw new Error(`Template not found: ${order.template_id}`);

    const images: Record<string, Buffer> = {};
    for (const p of poses) {
      const file = await db.storage.from(BUCKETS.generated).download(p.image_path!);
      if (file.error) throw file.error;
      images[p.pose_key] = Buffer.from(await file.data.arrayBuffer());
    }

    const pdf = await composeBooklet(template, images);
    const path = `${order.user_id}/${order.id}/booklet.pdf`;
    const up = await db.storage.from(BUCKETS.booklets).upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;

    await db.from("booklets").upsert({ order_id: order.id, pdf_path: path }, { onConflict: "order_id" });
    await setOrderStatus(order.id, "ready");
  } catch (err) {
    // Poses are all done, so composing can simply be retried
    await setOrderStatus(order.id, "generating_poses");
    throw err;
  }

  return NextResponse.json({ ok: true });
});
