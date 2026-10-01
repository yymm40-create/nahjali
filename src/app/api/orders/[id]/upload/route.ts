import { NextResponse } from "next/server";
import sharp from "sharp";
import { getOwnedOrder, handle, MESSAGES, requireApiUser, UserError } from "@/lib/api";
import { BUCKETS, createAdminClient } from "@/lib/supabase/admin";
import { sourcePath } from "@/lib/orders";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** Stores the customer's photo (normalized PNG) as the reference for character generation. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const order = await getOwnedOrder(id, user.id);

  if (order.status === "pending_payment") throw new UserError(MESSAGES.notPaid, 402);
  // The photo can be replaced until the character is approved, as long as attempts remain
  if (!["paid", "awaiting_approval"].includes(order.status)) throw new UserError(MESSAGES.wrongStep, 409);
  if (order.attempts_used >= order.attempts_allowed) throw new UserError(MESSAGES.noAttempts, 403);

  const form = await req.formData();
  const file = form.get("photo");
  if (!(file instanceof File) || !ALLOWED.includes(file.type) || file.size > MAX_BYTES) {
    throw new UserError(MESSAGES.badImage, 400);
  }

  let png: Buffer;
  try {
    // Apply phone EXIF rotation, cap the size (smaller upload to OpenAI), strip metadata
    png = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize(1536, 1536, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    throw new UserError(MESSAGES.badImage, 400);
  }

  const { error } = await createAdminClient()
    .storage.from(BUCKETS.sources)
    .upload(sourcePath(order), png, { contentType: "image/png", upsert: true });
  if (error) throw error;

  return NextResponse.json({ ok: true });
});
