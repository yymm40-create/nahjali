import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { assistantTurn, type AssistantBody } from "@/lib/jawad/server/assistant";

// Claude answers (with the pictures it is shown)
export const maxDuration = 120;

/** JAWAD AI · «جواد»: one turn of the studio's assistant. It only suggests changes to the form; it never generates. */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = (await req.json().catch(() => ({}))) as AssistantBody;
  return NextResponse.json(await assistantTurn(user, owner, body));
});
