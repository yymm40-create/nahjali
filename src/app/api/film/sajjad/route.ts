import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireFilmApiUser } from "@/lib/film/access";
import { askSajjad, sajjadChat } from "@/lib/film/sajjad";

export const maxDuration = 120;

/** «سجاد»'s conversation in a film or a series: `?kind=film|series&id=…`. */
export const GET = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const u = new URL(req.url);
  return NextResponse.json(await sajjadChat(u.searchParams.get("kind"), u.searchParams.get("id"), user.id), { headers: { "cache-control": "no-store" } });
});

/** A question or a message to سجاد: `{ kind, id, text }`. */
export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const b = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown; text?: unknown };
  return NextResponse.json(await askSajjad(b.kind, b.id, user, b.text));
});
