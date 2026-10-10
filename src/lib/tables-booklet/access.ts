// «كتيب الجداول الذكي»: who may use it — anyone the site lets in for «booklet» (open to everyone once the site is open). Server only.
import { requireApiUser, UserError } from "@/lib/api";
import { can } from "@/lib/access";

export async function requireBookletUser() {
  const user = await requireApiUser();
  if (!(await can(user.email, "booklet"))) throw new UserError("«كتيب الجداول الذكي» مقفل لحسابك حاليًا.", 403);
  return user;
}
