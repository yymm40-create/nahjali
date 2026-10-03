import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireId, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { cleanLine } from "@/lib/mahdi/server/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Reports a book to the admin: `{ report: "reason" }`. */
export const POST = mahdiRoute(async (req: Request, { params }: Ctx) => {
  const { supabase, user } = await requireProfile(req);
  const id = requireId((await params).id);
  const body = await readJson(req);
  if (!("report" in body)) throw new UserError(t.errors.invalid, 400);
  const { data: book } = await supabase.from("mahdi_books").select("id").eq("id", id).maybeSingle();
  if (!book) throw new UserError(t.errors.notFound, 404);
  await supabase.from("mahdi_book_reports").upsert({ book_id: id, user_id: user.id, reason: cleanLine(body.report, 300) }, { ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
});
