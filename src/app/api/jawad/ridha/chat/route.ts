import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { robotTurn } from "@/lib/claude-run";
import { claudeTrouble } from "@/lib/film/anthropic";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { requireRidha, say } from "@/lib/ridha/server/chat";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * «الرضا فويس» · a message to «الرضا ماكس», with the studio as the page has it. Like every robot: the person's model
 * answers and its real usage is taken from their balance (the studio itself costs nothing).
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireJawadApiUser();
  await requireRidha(user.email);
  const b = (await req.json().catch(() => ({}))) as { message?: unknown; state?: unknown; turns?: unknown; model?: unknown };
  const message = String(b.message ?? "").trim();
  try {
    return NextResponse.json(await robotTurn(user, b.model, "محادثة الرضا ماكس", () => say(user.email ?? null, b), { said: message, reply: (r) => r.reply }, { memory: "isolated" }));
  } catch (e) {
    if (e instanceof UserError) throw e;
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    console.error("ridha chat", e);
    const raw = e instanceof Error ? e.message : String(e);
    throw new UserError(`الرضا ماكس ما قدر يرد الحين؛ جرّب بعد شوي.${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`, 502);
  }
});
