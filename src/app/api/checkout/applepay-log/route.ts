import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * TEMPORARY diagnosis (16 Nov 2026: Apple Pay's sheet opens and closes at once on the owner's iPhone, while Moyasar's
 * merchant session checks out from here): the payment page posts what Apple Pay itself reported — the step it reached and
 * the reason it closed — and it is written to the server log (Vercel → Logs, search «applepay-diag»). Nothing is stored.
 */
export async function POST(req: Request) {
  const text = (await req.text().catch(() => "")).slice(0, 2000);
  console.log("applepay-diag", req.headers.get("user-agent")?.slice(0, 160) ?? "", text);
  return NextResponse.json({ ok: true });
}
