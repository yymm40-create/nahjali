import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usernameGate } from "@/lib/username";

/**
 * Verifies a one-time email token (token_hash) and signs the user in.
 * Used by email links and by admin-generated sign-in links (scripts/login-link.mjs).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const gate = data.user ? await usernameGate(supabase, data.user, safeNext).catch(() => null) : null;
      return NextResponse.redirect(`${origin}${gate ?? safeNext}`);
    }
  }
  const jawad = safeNext === "/jawad-ai" || safeNext.startsWith("/jawad-ai/");
  return NextResponse.redirect(`${origin}${jawad ? `/jawad-ai/login?error=1&next=${encodeURIComponent(safeNext)}` : "/login?error=1"}`);
}
