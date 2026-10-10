import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { assistantTurn, type AssistantBody } from "@/lib/jawad/server/assistant";
import { robotTurn } from "@/lib/claude-run";

// Claude answers (with the pictures it is shown)
export const maxDuration = 120;

/** JAWAD AI · «جواد»: one turn of the studio's assistant. It only suggests changes to the form; it never generates. */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = (await req.json().catch(() => ({}))) as AssistantBody;
  // what the person just said, for the memory («ذاكرتي»)
  const said = (Array.isArray(body.messages) ? body.messages : []).filter((m): m is { role: string; text: string } => !!m && typeof m === "object" && (m as { role?: unknown }).role === "user" && typeof (m as { text?: unknown }).text === "string").at(-1)?.text ?? "";
  return NextResponse.json(await robotTurn(user, body.model, "محادثة جواد", () => assistantTurn(user, owner, body), { said, reply: (r) => r.reply }));
});
