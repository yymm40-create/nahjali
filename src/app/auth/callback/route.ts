import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { usernameGate } from "@/lib/username";

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Every account has a unique username, chosen (or confirmed) right after signing in
      const gate = data.user ? await usernameGate(supabase, data.user, safeNext).catch(() => null) : null;
      return NextResponse.redirect(`${origin}${gate ?? safeNext}`);
    }
  }
  // «لأجل المهدي» and «الجواد الذكي!» have their own sign-in pages
  const own = ["/mahdi", "/jawad-ai"].find((p) => safeNext === p || safeNext.startsWith(`${p}/`));
  const loginPage = own ? `${own}/login` : "/login";
  return NextResponse.redirect(`${origin}${loginPage}?error=1${own === "/jawad-ai" ? `&next=${encodeURIComponent(safeNext)}` : ""}`);
}
