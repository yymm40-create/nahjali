import { NextResponse } from "next/server";
import { check, mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { t } from "@/lib/mahdi/i18n";

/** Saves the order of habits inside a project (ids in the new order). */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const { ids } = await readJson(req);
  if (!Array.isArray(ids) || ids.length > 500) throw new UserError(t.errors.invalid, 400);
  check(await supabase.rpc("mahdi_reorder_habits", { p_ids: ids.map(requireId) }));
  return NextResponse.json({ ok: true });
});
