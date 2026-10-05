import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { outputFile } from "@/lib/jawad/student/actions";

/** «الطالب الذكي» · a made file (`?name=pdf|pptx|…&inline=1`): a 10-minute link, after the ownership check. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { user } = await requireJawadApiUser();
  const url = new URL(req.url);
  const link = await outputFile(user.id, (await ctx.params).id, url.searchParams.get("name") ?? "");
  if (url.searchParams.get("inline")) {
    // for previews (audio player, PDF frame): the same signed file without the download header
    const u = new URL(link);
    u.searchParams.delete("download");
    return NextResponse.redirect(u.toString());
  }
  return NextResponse.redirect(link);
});
