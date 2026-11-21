import { mahdiRoute, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { sheikhFileResponse } from "@/lib/mahdi/server/sheikh";

export const dynamic = "force-dynamic";

/** `?q=<question>&f=<file>`: a file the agent made for one of my questions (the Word file of a «بحث شامل»). */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const u = new URL(req.url);
  const q = u.searchParams.get("q") ?? "";
  const f = u.searchParams.get("f") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(q) || !/^[\w-]{3,100}$/.test(f)) throw new UserError("ملف غير صحيح.", 400);
  return sheikhFileResponse(user.id, q, f);
});
