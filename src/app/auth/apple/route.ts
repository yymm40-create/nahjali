import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Starts «تسجيل الدخول باستخدام Apple» on the server and sends the browser to Apple. The button only navigates here, so it can
 * never hang in the browser (the browser-side sign-in call sometimes waited forever on its storage lock and the
 * button stayed on «جاري التحويل…»). The PKCE secret goes into a cookie that /auth/callback reads back.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next : "/";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext)}`, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    const own = ["/mahdi", "/jawad-ai"].find((p) => safeNext === p || safeNext.startsWith(`${p}/`));
    return NextResponse.redirect(`${origin}${own ? `${own}/login` : "/login"}?error=1&next=${encodeURIComponent(safeNext)}`);
  }
  return NextResponse.redirect(data.url);
}
