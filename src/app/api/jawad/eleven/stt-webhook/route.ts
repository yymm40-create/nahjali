import { NextResponse } from "next/server";

/**
 * The speech-to-text webhook to register in the ElevenLabs account (Settings → Webhooks, for «Speech to text»).
 * ElevenLabs only runs a transcription from a link in the background when the account has one; the site then polls
 * the result by its id (lib/jawad/student/media.ts), so what arrives here is only acknowledged, never trusted or kept.
 */
export async function POST() {
  return NextResponse.json({ ok: true });
}
