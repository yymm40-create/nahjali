import { handle, requireApiUser, UserError } from "@/lib/api";
import { servePiece } from "@/lib/learn/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * One piece of the video, locked with the viewing's own key. Only the player's own script asks for it: the custom header
 * and the same-origin check shut out a plain link, a download manager, or another site's page.
 */
export const GET = handle(async (req: Request) => {
  const site = req.headers.get("sec-fetch-site");
  if (req.headers.get("x-learn") !== "1" || (site && site !== "same-origin")) throw new UserError("غير مسموح.", 403);
  const user = await requireApiUser();
  const q = new URL(req.url).searchParams;
  const s = q.get("s") ?? "";
  const n = Number(q.get("n"));
  if (!/^[0-9a-f-]{36}$/.test(s) || !Number.isInteger(n) || n < 0 || n > 10_000) throw new UserError("طلب غير صحيح.", 400);
  const bytes = await servePiece(user, s, n);
  return new Response(bytes as unknown as BodyInit, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "private, no-store, max-age=0",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
      "cross-origin-resource-policy": "same-origin",
    },
  });
});
