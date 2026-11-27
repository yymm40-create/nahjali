import { NextResponse } from "next/server";
import { mahdiRoute, readJson } from "@/lib/mahdi/server/api";
import { saveVote } from "@/lib/mahdi/server/vote";
import { clientIp } from "@/lib/rate-limit";

/** «تصويت محبوبة الباري» (no sign-in): `{ name, performer, reason?, radood, website, typedMs }` — one vote, cleaned and limited. */
export const POST = mahdiRoute(async (req: Request) => {
  const b = await readJson(req, 4 * 1024);
  await saveVote(b, clientIp(req.headers));
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
});
