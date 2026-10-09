import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireFilmApiUser } from "@/lib/film/access";
import { withClaude } from "@/lib/film/claude-model";
import { applySajjad, askSajjad, decideResearch, dropSajjad, sajjadChat } from "@/lib/film/sajjad";

export const maxDuration = 120;

/** «سجاد»'s conversation in a film or a series: `?kind=film|series&id=…`. */
export const GET = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const u = new URL(req.url);
  return NextResponse.json(await sajjadChat(u.searchParams.get("kind"), u.searchParams.get("id"), user.id), { headers: { "cache-control": "no-store" } });
});

/** A question or a message to سجاد: `{ kind, id, text }` — or a decision on his findings: `{ kind, id, action: "research", approve: [ids], drop: [ids] }`. */
export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const b = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown; text?: unknown; action?: unknown; approve?: unknown; drop?: unknown; model?: unknown };
  if (b.action === "research") return NextResponse.json({ research: await decideResearch(b.kind, b.id, user.id, b) });
  // «تدخّل سجاد»: his proposed changes to the work, applied or dropped
  if (b.action === "apply") return NextResponse.json(await applySajjad(b.kind, b.id, user));
  if (b.action === "drop") {
    await dropSajjad(b.kind, b.id, user.id);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(await withClaude(b.model, () => askSajjad(b.kind, b.id, user, b.text)));
});
