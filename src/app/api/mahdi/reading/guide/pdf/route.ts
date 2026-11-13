import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { attachGuidePdf, loadGuide, removeGuidePdf } from "@/lib/mahdi/server/guide";

export const runtime = "nodejs";

async function owner(req: Request) {
  const s = await requireProfile(req);
  if (!isAdmin(s.user.email)) throw new UserError(t.reading.guide.adminOnly, 403);
  return s;
}

/** The owner gives a guide book its PDF: `{ id, pdf: path, pages }` → the fresh guide state. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await owner(req);
  await attachGuidePdf(user.id, await readJson(req));
  return NextResponse.json({ ...(await loadGuide(supabase)), admin: true });
});

/** The owner removes a guide book's PDF: `{ id }`. */
export const DELETE = mahdiRoute(async (req: Request) => {
  const { supabase } = await owner(req);
  await removeGuidePdf((await readJson(req)).id);
  return NextResponse.json({ ...(await loadGuide(supabase)), admin: true });
});
