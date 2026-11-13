import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { originOf } from "@/lib/mcp/meta";
import { CODE_TTL_S, clientMark, redirectAllowed, sign, verify, type RequestNote } from "@/lib/mcp/tokens";

/**
 * «الجواد في كلاود وشات جي بي تي» · the consent page's answer. «اسمح» → a one-time code back to Claude / ChatGPT;
 * «لا» → access_denied. Only from our own page (same origin, the person's own sign-in cookie).
 */
export const POST = async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && origin !== originOf(req)) return text("طلب غير مسموح.", 403);
  const form = await req.formData().catch(() => null);
  const r = String(form?.get("r") ?? "");
  const note = verify<RequestNote & Record<string, unknown>>("req", r);
  if (!note || !redirectAllowed(note.uri)) return text("انتهى طلب الربط. ارجع واضغط «ربط» مرة ثانية.", 400);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/jawad-ai/connect/authorize?r=${encodeURIComponent(r)}`, originOf(req)), 303);
  const back = new URL(note.uri);
  if (form?.get("decision") !== "allow") {
    back.searchParams.set("error", "access_denied");
    back.searchParams.set("error_description", "The person did not allow it.");
  } else {
    back.searchParams.set("code", sign("code", { uid: user.id, cm: clientMark(note.cid), uri: note.uri, cc: note.cc }, CODE_TTL_S));
  }
  if (note.st) back.searchParams.set("state", note.st);
  return NextResponse.redirect(back, 303);
};

const text = (t: string, status: number) => new Response(t, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
