import { NextResponse } from "next/server";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { t } from "@/lib/mahdi/i18n";

/** Saves the projects' order (ids in the new order). */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const { ids } = await readJson(req);
  if (!Array.isArray(ids) || ids.length > 200) throw new UserError(t.errors.invalid, 400);
  check(await supabase.rpc("mahdi_reorder_projects", { p_ids: ids.map(requireId) }));
  return NextResponse.json({ ok: true });
});
