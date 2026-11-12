import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { publicPost, publicReview } from "@/lib/editor/review-server";

type Ctx = { params: Promise<{ slug: string }> };
const noStore = { headers: { "Cache-Control": "no-store" } };

/** «رابط مراجعة للعميل» (no sign-in): the link's videos and comments while it is on; only its state when not. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const r = await publicReview((await ctx.params).slug);
  if (!r) return NextResponse.json({ error: "ما لقينا هذا الرابط." }, { status: 404 });
  return NextResponse.json(r, noStore);
});

/** `{ action: "comment" | "approve", versionId, name, body?, at?, shape?, parentId?, website, typedMs }` — cleaned, limited. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { slug } = await ctx.params;
  // a comment is short: a big body is refused before it is read as JSON
  const raw = await req.text();
  if (raw.length > 8000) return NextResponse.json({ error: "الطلب أكبر من المسموح." }, { status: 413 });
  let b: Record<string, unknown> = {};
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) b = v as Record<string, unknown>;
  } catch {}
  const done = await publicPost(slug, b, clientIp(req.headers));
  const r = await publicReview(slug);
  return NextResponse.json({ ...done, comments: r?.comments ?? [] }, noStore);
});
