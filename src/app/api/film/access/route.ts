import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { answerAccess, pendingForOwner, requestAccess, revokeAccess } from "@/lib/film/admin-access";

type Body =
  | { action: "request"; projectId: string }
  | { action: "answer"; id: string; allow: boolean }
  | { action: "revoke"; id: string };

/** «اسمح للأدمن بالدخول على مشروعك»: the admin asks, the owner allows or refuses, either one stops it. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const body = (await req.json().catch(() => ({}))) as Body;
  if (body.action === "request") {
    const r = await requestAccess(user, String(body.projectId ?? ""));
    return NextResponse.json({ status: r.status, id: r.id });
  }
  if (body.action === "answer") {
    await answerAccess(user, String(body.id ?? ""), body.allow === true);
    return NextResponse.json({ ok: true });
  }
  if (body.action === "revoke") {
    await revokeAccess(user, String(body.id ?? ""));
    return NextResponse.json({ ok: true });
  }
  throw new UserError("طلب غير معروف.", 400);
});

/** The requests waiting for my answer (the site shows them wherever I am); signed out: none. */
export const GET = handle(async () => {
  const { data } = await (await createClient()).auth.getUser();
  const pending = data.user ? await pendingForOwner(data.user.id) : [];
  return NextResponse.json({ pending }, { headers: { "Cache-Control": "no-store" } });
});
