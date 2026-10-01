import { NextResponse } from "next/server";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { getApprovedCharacter, setOrderStatus, staleBefore } from "@/lib/orders";
import { checkRateLimit, logGeneration } from "@/lib/generation";
import { generateFromReference } from "@/lib/openai";
import type { Order, Pose } from "@/lib/types";
import { POSE_PROMPTS } from "@config/prompts";
import { POSE_MAX_RETRIES } from "@config/pricing";

export const maxDuration = 300;

/**
 * Generates ONE pending pose per request (keeps each request well under the time limit).
 * The progress page calls this repeatedly until `remaining` is 0.
 */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);
  if (order.status === "pending_payment") throw new UserError(MESSAGES.notPaid, 402);
  if (order.status !== "generating_poses") throw new UserError(MESSAGES.wrongStep, 409);

  const character = await getApprovedCharacter(order.id);
  if (!character?.base_image_path) throw new Error("Order has no approved character");

  const db = createAdminClient();
  const loadPoses = async () =>
    ((await db.from("poses").select("*").eq("character_id", character.id)).data ?? []) as Pose[];

  let poses = await loadPoses();
  const next = poses.find((p) => p.status === "pending" && (!p.started_at || p.started_at < staleBefore()));

  if (next) {
    await checkRateLimit(user.id);

    // Optimistic lock: only one request can take this pose at this attempt count
    const { data: claimed } = await db
      .from("poses")
      .update({ started_at: new Date().toISOString(), attempts: next.attempts + 1 })
      .eq("id", next.id)
      .eq("attempts", next.attempts)
      .eq("status", "pending")
      .select()
      .maybeSingle();

    if (claimed) await generatePose(order, character.base_image_path, claimed as Pose);
    poses = await loadPoses();
  }

  const done = poses.filter((p) => p.status === "done").length;
  const failed = poses.filter((p) => p.status === "failed").length;
  const remaining = poses.length - done - failed;

  if (remaining === 0 && failed > 0) await setOrderStatus(order.id, "failed");

  return NextResponse.json({ total: poses.length, done, failed, remaining });
});

async function generatePose(order: Order, characterPath: string, pose: Pose) {
  const db = createAdminClient();
  const prompt = POSE_PROMPTS[pose.pose_key];
  try {
    if (!prompt) throw new Error(`No prompt for pose "${pose.pose_key}" in config/prompts.ts`);
    const ref = await db.storage.from(BUCKETS.generated).download(characterPath);
    if (ref.error) throw ref.error;

    // The APPROVED character is the reference, so every page shows the same character
    const image = await generateFromReference(Buffer.from(await ref.data.arrayBuffer()), prompt, order.quality, true);
    await logGeneration(order.id, "pose", order.quality, true);

    const path = `${order.user_id}/${order.id}/pose-${pose.pose_key}.png`;
    const up = await db.storage.from(BUCKETS.generated).upload(path, image, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    await db.from("poses").update({ status: "done", image_path: path, started_at: null }).eq("id", pose.id);
  } catch (err) {
    console.error(`pose ${pose.pose_key} failed (attempt ${pose.attempts})`, err);
    await logGeneration(order.id, "pose", order.quality, false, err);
    // First try + POSE_MAX_RETRIES retries, then give up
    const giveUp = pose.attempts >= 1 + POSE_MAX_RETRIES;
    await db
      .from("poses")
      .update({ status: giveUp ? "failed" : "pending", started_at: null })
      .eq("id", pose.id);
  }
}
