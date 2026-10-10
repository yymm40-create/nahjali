import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { getVisibility, setVisibility } from "@/lib/kharq/access";
import { getPersona, resetPersona, savePersona } from "@/lib/kharq/persona";
import { isAdmin } from "@config/site";

export const dynamic = "force-dynamic";

async function owner() {
  const user = await requireApiUser();
  if (!isAdmin(user.email)) throw new UserError("غير مسموح.", 404);
  return user;
}

/** The dashboard's view of «محمد الخارق»: his template and who may open the branch. */
export const GET = handle(async () => {
  await owner();
  const [persona, visibility] = await Promise.all([getPersona(), getVisibility()]);
  return NextResponse.json({ visibility, persona });
});

/** One action of the dashboard (see /admin/kharq). */
export const POST = handle(async (req: Request) => {
  await owner();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
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
      default:
        throw new UserError("طلب غير معروف.", 400);
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
    if (e instanceof Error && /القالب/.test(e.message)) throw new UserError(e.message, 400);
    throw e;
  }
});
