import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { mahdiRoute, readJson, requireUser, UserError } from "@/lib/mahdi/server/api";
import { parseDate } from "@/lib/mahdi/server/validate";

const KINDS = ["day", "week", "month"] as const;
type Kind = (typeof KINDS)[number];
const NOTE_MAX = 2000;

const kindOf = (v: unknown): Kind => {
  if (typeof v !== "string" || !(KINDS as readonly string[]).includes(v)) throw new UserError(t.errors.invalid, 400);
  return v as Kind;
};

/** The note I wrote for a day, a week or a month of the review: ?kind=day|week|month&start=YYYY-MM-DD. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireUser(req);
  const q = new URL(req.url).searchParams;
  const { data, error } = await supabase.from("mahdi_review_notes").select("note").eq("kind", kindOf(q.get("kind"))).eq("period_start", parseDate(q.get("start"))).maybeSingle();
  // before the migration runs the table is missing: no note, not an error
  if (error && error.code !== "42P01" && error.code !== "PGRST205") throw new UserError(t.errors.generic, 500);
  return NextResponse.json({ note: (data as { note?: string } | null)?.note ?? "", ready: !error }, { headers: { "Cache-Control": "private, no-store" } });
});

/** Saves (or clears) the note: { kind, start, note }. */
export const PUT = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireUser(req);
  const body = await readJson(req);
  const kind = kindOf(body.kind);
  const start = parseDate(body.start);
  const note = typeof body.note === "string" ? body.note.replace(/\r\n/g, "\n").trim().slice(0, NOTE_MAX) : "";
  const { error } = note
    ? await supabase.from("mahdi_review_notes").upsert({ user_id: user.id, kind, period_start: start, note, updated_at: new Date().toISOString() }, { onConflict: "user_id,kind,period_start" })
    : await supabase.from("mahdi_review_notes").delete().eq("kind", kind).eq("period_start", start);
  if (error) throw new UserError(t.errors.generic, 500);
  return NextResponse.json({ ok: true });
});
