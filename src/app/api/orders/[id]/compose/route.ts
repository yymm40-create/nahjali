import { NextResponse } from "next/server";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { claimOrder, getApprovedCharacter, setOrderStatus } from "@/lib/orders";
import { composeBooklet } from "@/lib/compose";
import { specOf, templateFor } from "@/lib/tables-booklet/server";
import type { Order, OrderStatus, Pose } from "@/lib/types";

import { storage } from "@/lib/storage";
export const maxDuration = 120;

/** Builds the PDF once every pose is done (or at once for a designed booklet without a picture), stores it, and marks the order ready. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);
  if (order.status === "ready") return NextResponse.json({ ok: true });

  // «كتيب الجداول الذكي» without a picture: drawn at once, nothing to wait for
  const design = specOf(order)?.design;
  if (design && !design.photo) {
    if (!["paid", "composing"].includes(order.status)) throw new UserError(MESSAGES.wrongStep, 409);
    await composeNow(order, ["paid"], {});
    return NextResponse.json({ ok: true });
  }

  if (!["generating_poses", "composing"].includes(order.status)) throw new UserError(MESSAGES.wrongStep, 409);
  const character = await getApprovedCharacter(order.id);
  if (!character) throw new Error("Order has no approved character");
  const db = createAdminClient();
  const poses = ((await db.from("poses").select("*").eq("character_id", character.id)).data ?? []) as Pose[];
  if (poses.length === 0 || poses.some((p) => p.status !== "done" || !p.image_path)) {
    throw new UserError(MESSAGES.wrongStep, 409);
  }

  const images: Record<string, Buffer> = {};
  for (const p of poses) {
    const file = await storage.from(BUCKETS.generated).download(p.image_path!);
    if (file.error) throw file.error;
    images[p.pose_key] = Buffer.from(await file.data.arrayBuffer());
  }
  await composeNow(order, ["generating_poses"], images);
  return NextResponse.json({ ok: true });
});

/** Draws the PDF from the pictures, stores it, and marks the order ready (back a step when it fails, to be retried). */
async function composeNow(order: Order, from: OrderStatus[], images: Record<string, Buffer>) {
  const claimed = await claimOrder(order.id, from, "composing");
  if (!claimed) throw new UserError(MESSAGES.busy, 409);
  try {
    const template = await templateFor(order);
    if (!template) throw new Error(`Template not found: ${order.template_id}`);
    const pdf = await composeBooklet(template, {
      style: order.style,
      childName: order.child_name ?? "",
      parentMessage: order.parent_message ?? "",
      poses: images,
    });
    const path = `${order.user_id}/${order.id}/booklet.pdf`;
    const up = await storage.from(BUCKETS.booklets).upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
    await createAdminClient().from("booklets").upsert({ order_id: order.id, pdf_path: path }, { onConflict: "order_id" });
    await setOrderStatus(order.id, "ready");
  } catch (err) {
    // the pictures are all there, so composing can simply be retried
    await setOrderStatus(order.id, from[0]);
    throw err;
  }
}
