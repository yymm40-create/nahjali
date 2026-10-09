import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { BOOKLET_PATHS, JAWAD_PATH_HEADER, OWN_CHROME_HEADER } from "@config/site";
import { can } from "@/lib/access";
import { clientIp, rulesFor, take } from "@/lib/rate-limit";

// Pages that require a signed-in user
const PROTECTED = ["/new", "/order", "/my-booklets", "/admin", "/film", "/coins"];

/** Refreshes the Supabase session cookie on every request and guards protected pages. */
export async function proxy(request: NextRequest) {
  // too many requests from one address: refused before anything else runs
  const rules = rulesFor(request.nextUrl.pathname, request.method);
  if (rules.length) {
    const wait = take(clientIp(request.headers), rules);
    if (wait) return NextResponse.json({ error: `طلبات كثيرة في وقت قصير. انتظر ${wait} ثانية وجرّب مرة ثانية.` }, { status: 429, headers: { "Retry-After": String(wait) } });
  }
  // If Supabase falls back to the Site URL after sign-in, finish the login on our callback route
  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  // The home page is «الجواد الذكي»: the address itself opens it (the old two-branch home is cancelled for now, see src/app/page.tsx)
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/jawad-ai";
    return NextResponse.redirect(url);
  }

  // «الجواد الذكي!» | JAWAD AI renders none of the main site's chrome, not even on the server (see the root layout).
  // Always overwritten here, so a client can never set it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(OWN_CHROME_HEADER);
  requestHeaders.delete(JAWAD_PATH_HEADER);
  const jawad = request.nextUrl.pathname === "/jawad-ai" || request.nextUrl.pathname.startsWith("/jawad-ai/");
  if (jawad) {
    requestHeaders.set(OWN_CHROME_HEADER, "jawad-ai");
    requestHeaders.set(JAWAD_PATH_HEADER, request.nextUrl.pathname);
  }
  const forward = { request: { headers: requestHeaders } };

  let response = NextResponse.next(forward);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
            requestHeaders.set("cookie", request.cookies.toString());
          });
          response = NextResponse.next(forward);
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // The film maker lives only inside «الجواد الذكي!»: old /film links open the same page there
  if (path === "/film" || path.startsWith("/film/")) {
    const url = request.nextUrl.clone();
    url.pathname = `/jawad-ai${path}`;
    return NextResponse.redirect(url);
  }

  // «كتيب نهج علي»: for those «السماح» (the dashboard's one list) lets in (pages and API)
  if (BOOKLET_PATHS.some((p) => path === p || path.startsWith(p + "/")) && !(await can(user?.email, "booklet"))) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|editor-sw\\.js|.*\\.(?:png|jpg|jpeg|svg|webp|webmanifest)$).*)"],
};
