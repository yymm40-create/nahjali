import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** «الطالب الذكي» · a student's feedback (rating and/or a note), shown on the owner's statistics page. */
export const POST = handle(async (req: Request) => {
  const b = (await req.json().catch(() => ({}))) as { rating?: unknown; message?: unknown; stage?: unknown; projectId?: unknown };
  const rating = Number(b.rating);
  const message = String(b.message ?? "").trim().slice(0, 3000);
  const ok = Number.isInteger(rating) && rating >= 1 && rating <= 5;
  if (!ok && !message) throw new UserError("اختر تقييمًا أو اكتب ملاحظتك.");
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  const projectId = typeof b.projectId === "string" && /^[0-9a-f-]{36}$/.test(b.projectId) ? b.projectId : null;
  const { error } = await createAdminClient()
    .from("student_feedback")
    .insert({ user_id: user?.id ?? null, project_id: projectId, stage: String(b.stage ?? "").slice(0, 40), rating: ok ? rating : null, message });
  if (error) throw new UserError("تعذّر إرسال رأيك الآن، جرّب بعد قليل.", 503);
  return NextResponse.json({ ok: true });
});
