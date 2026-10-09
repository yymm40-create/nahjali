import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { diagnosePlatform, type DiagnoseTurn } from "@/lib/diagnose/platform";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Owner only — the 🐞 button's diagnostician. Body: { message, report, path, history: [{role, text}] }.
 * Returns { reply, developerMessage, missing, looked, rounds }: Claude looked at the browser's report, the server's
 * state and the site's own code, and says why (and what to send or do), plus a message to copy for the developer.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  const b = (await req.json().catch(() => ({}))) as { message?: unknown; report?: unknown; path?: unknown; history?: unknown };
  const history: DiagnoseTurn[] = (Array.isArray(b.history) ? b.history : [])
    .filter((h): h is { role: "user" | "assistant"; text: string } => !!h && typeof h === "object" && ((h as { role?: unknown }).role === "user" || (h as { role?: unknown }).role === "assistant") && typeof (h as { text?: unknown }).text === "string")
    .slice(-10)
    .map((h) => ({ role: h.role, text: h.text.slice(0, 8000) }));
  const message = String(b.message ?? "").trim();
  if (!message && !history.length) throw new UserError("اكتب وش صار أو اسأل ليش.", 400);
  const d = await diagnosePlatform({ message, report: String(b.report ?? "").slice(0, 60_000), path: String(b.path ?? ""), history });
  return NextResponse.json({ reply: d.reply, developerMessage: d.developerMessage, missing: d.missing, looked: d.looked, rounds: d.rounds });
});
