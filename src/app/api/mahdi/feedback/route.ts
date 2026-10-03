import { NextResponse } from "next/server";
import { t } from "@/lib/mahdi/i18n";
import { check, mahdiRoute, readJson, requireProfile, UserError } from "@/lib/mahdi/server/api";
import { cleanLine, cleanText, oneOf } from "@/lib/mahdi/server/validate";

const DAY_MS = 24 * 3600_000;
/** The popup waits until the account is a few days old, and does not come back soon after an answer or a «ليس الآن». */
const PROMPT = { minAgeDays: 3, afterSentDays: 45, afterDismissDays: 14 };
const MAX_PER_DAY = 5;
const KINDS = ["general", "idea", "problem", "praise"] as const;

/** Whether to show the occasional «كيف تجربتك؟» popup now. Everything is read through the user's own RLS client. */
export const GET = mahdiRoute(async (req: Request) => {
  const { supabase } = await requireProfile(req);
  const [profile, last, prompt] = await Promise.all([
    supabase.from("mahdi_profiles").select("created_at").maybeSingle(),
    supabase.from("mahdi_feedback").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("mahdi_feedback_prompt").select("dismissed_at").maybeSingle(),
  ]);
  // Before migration 0013 runs the tables are missing: never prompt
  if (last.error || prompt.error) return NextResponse.json({ prompt: false });
  const ago = (iso: string | null | undefined) => (iso ? (Date.now() - new Date(iso).getTime()) / DAY_MS : Infinity);
  const show =
    ago(profile.data?.created_at) !== Infinity &&
    ago(profile.data?.created_at) >= PROMPT.minAgeDays &&
    ago(last.data?.created_at) >= PROMPT.afterSentDays &&
    ago(prompt.data?.dismissed_at) >= PROMPT.afterDismissDays;
  return NextResponse.json({ prompt: show });
});

/** Sends feedback `{ rating?, kind, message, place }`, or closes the popup for a while: `{ dismiss: true }`. */
export const POST = mahdiRoute(async (req: Request) => {
  const { supabase, user } = await requireProfile(req);
  const body = await readJson(req);
  if (body.dismiss === true) {
    check(await supabase.from("mahdi_feedback_prompt").upsert({ user_id: user.id, dismissed_at: new Date().toISOString() }));
    return NextResponse.json({ ok: true });
  }
  const rating = body.rating == null ? null : Number(body.rating);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) throw new UserError(t.errors.invalid, 400);
  const message = cleanText(body.message, 1000);
  if (rating === null && !message) throw new UserError(t.feedback.needSomething, 400);
  const since = new Date(Date.now() - DAY_MS).toISOString();
  const { count } = await supabase.from("mahdi_feedback").select("id", { count: "exact", head: true }).gte("created_at", since);
  if ((count ?? 0) >= MAX_PER_DAY) throw new UserError(t.feedback.tooMany, 429);
  check(
    await supabase.from("mahdi_feedback").insert({
      user_id: user.id,
      rating,
      kind: body.kind == null ? "general" : oneOf(body.kind, KINDS),
      message,
      place: cleanLine(body.place, 30).replace(/[^a-z_-]/g, ""),
    }),
  );
  return NextResponse.json({ ok: true });
});
