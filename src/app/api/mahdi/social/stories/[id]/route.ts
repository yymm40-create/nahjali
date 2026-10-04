import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/mahdi/social";
import { report } from "@/lib/mahdi/server/social";
import { deleteStory, storyViewers, viewStory } from "@/lib/mahdi/server/stories";
import { cleanLine } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Who saw one of my stories. */
export const GET = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  return NextResponse.json({ viewers: await storyViewers(user.id, requireId((await params).id)) });
});

/** `{ view: true }` counts my view; `{ report, category }` reports it to the owner. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  if (body.view === true) {
    await viewStory(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  }
  if ("report" in body) {
    const category: ReportCategory = REPORT_CATEGORIES.includes(body.category as ReportCategory) ? (body.category as ReportCategory) : "other";
    await report(supabase, user.id, { story: id }, category, cleanLine(body.report, 300));
    return NextResponse.json({ ok: true });
  }
  throw new UserError(t.errors.invalid, 400);
});

/** Deletes one of my stories. */
export const DELETE = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { user } = await requireProfile(req);
  await deleteStory(requireId((await params).id), user.id);
  return NextResponse.json({ ok: true });
});
