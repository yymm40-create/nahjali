import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { callClaudeJson, claudeWhy, isLeader } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { cleanLinks, cleanTurns, SALMAN, SALMAN_SCHEMA, SALMAN_TASK } from "@/lib/salman";

export const dynamic = "force-dynamic";
// he reads the whole platform knowledge with every question: room for a slow first read
export const maxDuration = 120;

/**
 * «سلمان»: one answer about the site. Body: { messages: [{ role, text }…], page }. Open to everyone (signed in or not): it costs the
 * site a little per answer, so the requests per address are limited (src/lib/rate-limit.ts).
 */
export const POST = handle(async (req: Request) => {
  const b = (await req.json().catch(() => ({}))) as { messages?: unknown; page?: unknown };
  const turns = cleanTurns(b.messages);
  if (!turns.length || turns[turns.length - 1].role !== "user") throw new UserError("اكتب سؤالك.", 400);
  const page = typeof b.page === "string" ? b.page.slice(0, 200) : "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  try {
    const r = await withClaude(SALMAN.model, () =>
      callClaudeJson<{ reply: string; links: unknown }>({
        system: `${SALMAN_TASK}\nPAGE: ${page || "/"}\nSIGNED IN: ${user ? "yes" : "no"}`,
        turns: turns.map((t) => ({ role: t.role, content: t.text })),
        schema: SALMAN_SCHEMA,
        // the model thinks before answering and that shares this budget: 1,500 cut the answer off before it was written
        maxTokens: 6000,
        effort: "low",
        leader: isLeader(user?.email),
      }),
    );
    return NextResponse.json({ reply: String(r.data.reply ?? "").trim().slice(0, 2000) || "ما فهمت عليك، تقدر تعيد السؤال بطريقة ثانية؟", links: cleanLinks(r.data.links) });
  } catch (e) {
    console.error("salman", e);
    // the real reason when it is known (busy, credit…), and for the owner the raw line too
    throw new UserError(claudeWhy(e, "سلمان مشغول شوي، جرّب بعد لحظات.", user?.email), 503);
  }
});
