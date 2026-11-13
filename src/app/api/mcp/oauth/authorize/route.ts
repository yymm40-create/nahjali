import { NextResponse } from "next/server";
import { originOf } from "@/lib/mcp/meta";
import { REQUEST_TTL_S, redirectAllowed, sign, verify, type ClientNote } from "@/lib/mcp/tokens";

/**
 * «الجواد في كلاود وشات جي بي تي» · the start of linking: the client's request is checked, then the person goes to our
 * consent page with it as one signed note (a sign-in on the way keeps it, since it is a short address).
 */
export const GET = async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const clientId = q.get("client_id") ?? "";
  const uri = q.get("redirect_uri") ?? "";
  const client = verify<ClientNote & Record<string, unknown>>("client", clientId);
  // nothing trustworthy to send the person back to: say so here
  if (!client) return plain("هذا الربط غير معروف. احذف الكونكتر وأضفه من جديد.");
  if (!client.uris.includes(uri) || !redirectAllowed(uri)) return plain("عنوان الرجوع غير مسموح لهذا الربط.");
  const back = (error: string, description: string) => {
    const u = new URL(uri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", description);
    if (q.get("state")) u.searchParams.set("state", q.get("state")!);
    return NextResponse.redirect(u, 302);
  };
  if (q.get("response_type") !== "code") return back("unsupported_response_type", "Only response_type=code.");
  const cc = q.get("code_challenge") ?? "";
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(cc)) return back("invalid_request", "PKCE with S256 is required.");
  const r = sign("req", { cid: clientId, name: client.name, uri, cc, st: q.get("state") }, REQUEST_TTL_S);
  const page = new URL("/jawad-ai/connect/authorize", originOf(req));
  page.searchParams.set("r", r);
  return NextResponse.redirect(page, 302);
};

const plain = (text: string) => new Response(text, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
