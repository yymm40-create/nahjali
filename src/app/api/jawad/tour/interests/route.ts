import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAnswers } from "@config/jawad/tour";

/** «جواد يتعرّف عليك»: what the person likes (from the tour), kept for the owner's offers. */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  const b = (await req.json().catch(() => ({}))) as { answers?: unknown; words?: unknown };
  const { answers, words } = readAnswers(b.answers, b.words);
  await createAdminClient()
    .from("jawad_settings")
    .upsert({ key: `interests:${user.id}`, value: { answers, words, email: user.email ?? null, at: new Date().toISOString() }, updated_by: "tour" }, { onConflict: "key" });
  return NextResponse.json({ ok: true });
});
