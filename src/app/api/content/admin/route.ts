import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { claudeTrouble } from "@/lib/film/anthropic";
import { getVisibility, setVisibility } from "@/lib/content/access";
import { getPersona, resetPersona, savePersona } from "@/lib/content/persona";
import { deleteRun, ESTIMATE_USD, listRuns, runStatus, startRun, stepRun, worst, type Mode } from "@/lib/content/tests";
import { CONTENT_KINDS } from "@config/content";
import { EXAMPLES_PER_KIND } from "@config/content-examples";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The dashboard's view: the persona, the example bank's size, the latest test runs. */
export const GET = handle(async (req: Request) => {
  await owner();
  const run = new URL(req.url).searchParams.get("run");
  if (run) return NextResponse.json({ status: await runStatus(run), worst: await worst(run) });
  const [persona, runs, visibility] = await Promise.all([getPersona(), listRuns(), getVisibility()]);
  return NextResponse.json({ visibility, persona, runs, estimate: ESTIMATE_USD, kinds: CONTENT_KINDS.map((k) => ({ id: k.id, name: k.name, examples: EXAMPLES_PER_KIND })) });
});

/** One action of the dashboard (see /admin/content). */
export const POST = handle(async (req: Request) => {
  await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id ?? "");
  try {
    switch (b.action) {
      case "visibility":
        await setVisibility(b.value as "owner" | "codes" | "all");
        return NextResponse.json({ ok: true });
      case "persona_save":
        await savePersona(String(b.text ?? ""));
        return NextResponse.json({ ok: true });
      case "persona_reset":
        await resetPersona();
        return NextResponse.json({ ok: true });
      case "test_start": {
        const mode: Mode = b.mode === "deep" ? "deep" : "quick";
        const count = Math.max(1, Math.min(1000, Math.floor(Number(b.count)) || 100));
        return NextResponse.json(await startRun(count, mode, String(b.label ?? "")));
      }
      case "test_step":
        return NextResponse.json(await stepRun(id, 3));
      case "test_delete":
        await deleteRun(id);
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    const why = claudeTrouble(e);
    if (why) throw new UserError(why, 503);
    throw e;
  }
  throw new UserError("إجراء غير معروف.");
});
