import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { worksPage } from "@/lib/jawad/server/works";
import type { WorksFilter } from "@/lib/jawad/labels";

const FILTERS: WorksFilter[] = ["all", "image", "video", "audio"];

/** JAWAD AI · one page of the user's works (newest first), only their own. */
export const GET = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const p = new URL(req.url).searchParams;
  const filter = (FILTERS as string[]).includes(p.get("filter") ?? "") ? (p.get("filter") as WorksFilter) : "all";
  return NextResponse.json(await worksPage(user.id, filter, p.get("cursor")));
});
