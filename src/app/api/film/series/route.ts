import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireFilmApiUser } from "@/lib/film/access";
import { createSeries } from "@/lib/film/series";

/** «المسلسل الذكي»: a new series (with its first episode) → `{ id }`. */
export const POST = handle(async (req: Request) => {
  const user = await requireFilmApiUser();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const series = await createSeries(user.id, body);
  return NextResponse.json({ id: series.id });
});
