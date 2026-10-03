import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { loadReading } from "@/lib/mahdi/server/reading";
import { applyToHabit, readingReply } from "@/lib/mahdi/server/reading-write";

type Ctx = { params: Promise<{ id: string }> };

/** Deletes one of my sessions; what it added to the linked habit is taken back. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, profile } = await requireProfile(req);
  const id = requireId((await params).id);
  const { data } = await supabase.from("mahdi_reading_sessions").delete().eq("id", id).select("log_date, seconds, pages_count");
  const s = data?.[0];
  if (!s) throw new UserError(t.errors.notFound, 404);
  const { goals } = await loadReading(supabase, profile.userId);
  await applyToHabit(supabase, goals, s.log_date, s.seconds, s.pages_count, -1).catch((e) => console.error("[mahdi reading habit]", e));
  return NextResponse.json(await readingReply(supabase, profile));
});
