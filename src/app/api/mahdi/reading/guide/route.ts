import { NextResponse } from "next/server";
import { isAdmin } from "@config/site";
import { mahdiRoute, readJson, requireProfile } from "@/lib/mahdi/server/api";
import { loadGuide, saveGuideEntry } from "@/lib/mahdi/server/guide";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** «مسبار القارئ»: my list (status and note per book), which guide books have a PDF, and whether I may attach PDFs. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  return NextResponse.json({ ...(await loadGuide(supabase)), admin: isAdmin(user.email) }, { headers: PRIVATE });
});

/** `{ id, status: "want" | "now" | "read" | null, note }` sets my entry for a guide book. */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  await saveGuideEntry(supabase, user.id, await readJson(req));
  return NextResponse.json({ ok: true });
});
