import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * The speech-to-text webhook registered in the ElevenLabs account (Settings → Webhooks, for «Speech to text»).
 * A transcription from a link runs in the background and the site polls its result by id (lib/jawad/student/media.ts);
 * but a FAILED one (the link could not be fetched, no sound…) is only told here, as a «webhook_error» with no
 * result to poll. So that failure is written on the job named in the metadata, which then stops at once instead of
 * waiting out its time limit. Nothing else from here is trusted or kept: a transcript is always read from ElevenLabs.
 */
export async function POST(req: Request) {
  const event = (await req.json().catch(() => null)) as { type?: unknown; error_message?: unknown; webhook_metadata?: unknown; data?: { webhook_metadata?: unknown } } | null;
  const meta = parseMeta(event?.webhook_metadata ?? event?.data?.webhook_metadata);
  console.log("stt webhook", String(event?.type ?? "?"), meta.studentJob ?? "-");
  if (event?.type === "webhook_error" && typeof meta.studentJob === "string" && UUID.test(meta.studentJob)) {
    const why = typeof event.error_message === "string" ? event.error_message.replace(/\s+/g, " ").trim().slice(0, 160) : "";
    const message = `ما قدرنا نفرّغ هذا المقطع${why ? ` (${why})` : ""}. ما انخصم منك شيء: جرّب رابطًا ثانيًا، أو ارفع الملف نفسه.`;
    // only a job of this kind that is still waiting
    await createAdminClient().from("student_jobs").update({ error: message }).eq("id", meta.studentJob).eq("kind", "media").in("status", ["queued", "running"]);
  }
  return NextResponse.json({ ok: true });
}

function parseMeta(v: unknown): Record<string, unknown> {
  if (typeof v === "string") {
    try {
      const j = JSON.parse(v);
      return j && typeof j === "object" ? (j as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
