import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { cleanUses, dayOf } from "@config/feature-use";

export const dynamic = "force-dynamic";

/**
 * «استخدام المزايا» (the owner's /admin/use): a page's batch of feature uses (src/lib/feature-track.ts), added to the
 * signed-in person's counts of the day. Only features of the list are counted; the body may come as text (sendBeacon).
 */
export async function POST(req: Request) {
  const uses = cleanUses(await req.text().then((t) => JSON.parse(t)).catch(() => null));
  if (!uses) return NextResponse.json({ ok: false, error: "ما فيه ميزة معروفة." }, { status: 400 });
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    // a visitor who is not signed in is not counted (the page stops sending)
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    await createAdminClient().rpc("jawad_feature_use_add", { p_user: user.id, p_day: dayOf(), p_uses: uses });
  } catch {
    /* the table may not be there yet (0110, run by hand): nothing is counted */
  }
  return NextResponse.json({ ok: true });
}
