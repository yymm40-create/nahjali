import { NextResponse } from "next/server";
import { handle, requireApiUser, UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@config/site";

/**
 * «احذف حسابي»: the person's account and everything tied to it (booklets, works, projects, coins, the editor's and
 * the assistants' conversations: their tables follow the account away). Asked for with the word «احذف» typed.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const b = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (String(b.confirm ?? "").trim() !== "احذف") throw new UserError("اكتب «احذف» للتأكيد.", 400);
  // the site's owner account runs the dashboard: not deleted from here
  if (isAdmin(user.email)) throw new UserError("حساب صاحب المنصة ما ينحذف من هنا.", 400);
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) throw new UserError("ما قدرنا نحذف الحساب الحين. جرّب بعد شوي أو راسلنا.", 500);
  return NextResponse.json({ ok: true });
});
