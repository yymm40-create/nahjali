import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { BOOKLET_PATHS } from "@config/site";
import { bookletOpenFor } from "@/lib/film/limits";

// Pages that require a signed-in user
const PROTECTED = ["/new", "/order", "/my-booklets", "/admin", "/film"];

/** Refreshes the Supabase session cookie on every request and guards protected pages. */
export async function proxy(request: NextRequest) {
  // If Supabase falls back to the Site URL after sign-in, finish the login on our callback route
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // «كتيب نهج علي»: open, closed (owner only) or for given emails, as set on /admin/limits (pages and API)
  if (BOOKLET_PATHS.some((p) => path === p || path.startsWith(p + "/")) && !(await bookletOpenFor(user?.email))) {
    if (path.startsWith("/api/")) return NextResponse.json({ error: "كتيب نهج علي تحت التطوير حاليًا." }, { status: 503 });
    const url = request.nextUrl.clone();
    url.pathname = "/under-development";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + "/"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Skip static assets and image files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
