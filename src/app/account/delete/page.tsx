import { requireUser } from "@/lib/auth";
import DeleteAccount from "./DeleteAccount";

export const metadata = { title: "حذف الحساب | نهج علي" };
export const dynamic = "force-dynamic";

/** «احذف حسابي»: what goes, and the word to type. */
export default async function DeleteAccountPage() {
  const user = await requireUser("/account/delete");
  return <DeleteAccount email={user.email ?? ""} />;
}
