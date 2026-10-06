import { NextResponse } from "next/server";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { claimOrder, getCharacters, setOrderStatus, sourcePath } from "@/lib/orders";
import { checkRateLimit, logGeneration, withHairCheck } from "@/lib/generation";
import { generateFromReference } from "@/lib/openai";
import { characterPrompt } from "@config/prompts";
import { STYLES } from "@config/styles";

import { storage } from "@/lib/storage";
// Image generation can take a couple of minutes
export const maxDuration = 300;

/** Generates (or re-generates) the base character from the uploaded photo. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);

  // Paid + attempts left are checked before anything costs money
  if (order.status === "pending_payment") throw new UserError(MESSAGES.notPaid, 402);
  if (order.attempts_used >= order.attempts_allowed) throw new UserError(MESSAGES.noAttempts, 403);
  if (!["paid", "awaiting_approval", "generating_character"].includes(order.status)) {
    throw new UserError(MESSAGES.wrongStep, 409);
  }
  await checkRateLimit(user.id);

  const db = createAdminClient();
  const source = await storage.from(BUCKETS.sources).download(sourcePath(order));
  if (source.error) throw new UserError(MESSAGES.noSource, 400);

  const claimed = await claimOrder(order.id, ["paid", "awaiting_approval"], "generating_character");
  if (!claimed) throw new UserError(MESSAGES.busy, 409);
  if (claimed.attempts_used >= claimed.attempts_allowed) {
    await restoreStatus(order.id);
    throw new UserError(MESSAGES.noAttempts, 403);
  }

  let image: Buffer;
  try {
    const photo = Buffer.from(await source.data.arrayBuffer());
    const gender = order.child_gender ?? "boy";
    // A girl's picture is only kept when no hair at all is visible
    image = await withHairCheck(gender, "character", order.id, order.quality, () =>
      generateFromReference(photo, characterPrompt(order.style, gender), order.quality, { cutout: false, styleReference: STYLES[order.style].referenceImage }),
    );
    await logGeneration(order.id, "character", order.quality, true);
  } catch (err) {
    console.error("character generation failed", err);
    await logGeneration(order.id, "character", order.quality, false, err);
    await restoreStatus(order.id); // a failed generation does not use up an attempt
    throw new UserError(MESSAGES.generationFailed, 502);
  }

  const attempt = claimed.attempts_used + 1;
  const path = `${order.user_id}/${order.id}/character-${attempt}-${Date.now()}.png`;
  const up = await storage.from(BUCKETS.generated).upload(path, image, { contentType: "image/png" });
  if (up.error) {
    await restoreStatus(order.id);
    throw up.error;
  }

  await db.from("characters").insert({
    order_id: order.id,
    source_image_path: sourcePath(order),
    base_image_path: path,
    attempt_number: attempt,
  });
  await setOrderStatus(order.id, "awaiting_approval", { attempts_used: attempt });

  return NextResponse.json({ ok: true, attemptsLeft: claimed.attempts_allowed - attempt });
});

/** Back to the right waiting status after a failure. */
async function restoreStatus(orderId: string) {
  const characters = await getCharacters(orderId);
  await setOrderStatus(orderId, characters.some((c) => c.base_image_path) ? "awaiting_approval" : "paid");
}
