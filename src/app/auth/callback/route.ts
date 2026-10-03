import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Google sends the user back here; we exchange the code for a session cookie. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Without a destination, the home page with all the sections
  const next = searchParams.get("next") ?? "/";
  // Only allow same-site relative redirects
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${safeNext}`);
  }
  // «لأجل المهدي» has its own sign-in page
  const loginPage = safeNext === "/mahdi" || safeNext.startsWith("/mahdi/") ? "/mahdi/login" : "/login";
  return NextResponse.redirect(`${origin}${loginPage}?error=1`);
}
