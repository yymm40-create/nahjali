import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { myGallery } from "@/lib/jawad/server/gallery";

export const dynamic = "force-dynamic";

/** The gallery and share-link state of some of the person's own results (?ids=<output>,<output>). */
export const GET = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const ids = (new URL(req.url).searchParams.get("ids") ?? "").split(",").filter(Boolean);
  return NextResponse.json(await myGallery(user.id, ids));
});
