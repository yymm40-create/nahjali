import { NextResponse } from "next/server";
import { mahdiRoute, requireProfile } from "@/lib/mahdi/server/api";
import { searchPeople } from "@/lib/mahdi/server/social";

/** «ابحث»: `?q=` people by name or username (forgiving), locked accounts left out. */
export const GET = mahdiRoute(async (req: Request) => {
  const { user } = await requireProfile(req);
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ people: await searchPeople(user.id, q) }, { headers: { "Cache-Control": "no-store" } });
});
