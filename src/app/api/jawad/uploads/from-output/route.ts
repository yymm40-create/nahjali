import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { uploadFromFilmAsset, uploadFromOutput, uploadViews } from "@/lib/jawad/server/uploads";

export const maxDuration = 60;

/**
 * JAWAD AI · "use as reference": copies one of the user's works into a new, checked reference —
 * a JAWAD result ({ outputId }) or a picture/video of their film projects ({ filmAssetId }).
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const { outputId, filmAssetId } = (await req.json().catch(() => ({}))) as { outputId?: unknown; filmAssetId?: unknown };
  const row = filmAssetId !== undefined ? await uploadFromFilmAsset(user.id, filmAssetId) : await uploadFromOutput(user.id, outputId);
  return NextResponse.json({ upload: (await uploadViews([row]))[0] });
});
