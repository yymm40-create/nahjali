import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { gptImagePickOf, setGptImagePick } from "@/lib/jawad/server/gpt-image-pick";
import { unlimitedStatus } from "@/lib/jawad/server/unlimited";
import { isGptImagePick } from "@config/jawad/gpt-image";
import { GPT_IMAGE_26_ID, GPT_IMAGE_2_ID } from "@config/jawad/generators";

export const dynamic = "force-dynamic";

/** «نسخة GPT Image»: the person's pick, and which versions their running «لامحدود» pass makes free. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const [pick, passes] = await Promise.all([gptImagePickOf(user.id), unlimitedStatus(user.id).catch(() => [])]);
  return NextResponse.json(
    { pick, unlimited: { two: passes.some((p) => p.generatorId === GPT_IMAGE_2_ID), twoSix: passes.some((p) => p.generatorId === GPT_IMAGE_26_ID) } },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { pick?: unknown };
  if (!isGptImagePick(b.pick)) throw new UserError("اختيار غير معروف.", 400);
  await setGptImagePick(user.id, b.pick);
  return NextResponse.json({ ok: true, pick: b.pick });
});
