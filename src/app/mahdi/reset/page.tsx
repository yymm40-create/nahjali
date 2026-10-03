import { getMahdiSession } from "@/lib/mahdi/server/session";
import { t } from "@/lib/mahdi/i18n";
import ResetForm from "./ResetForm";

export const metadata = { title: t.auth.resetTitle };

/** Reached from the reset email (the link signs the user in for this purpose). */
export default async function ResetPage() {
  const { user } = await getMahdiSession();
  return <ResetForm hasSession={Boolean(user)} />;
}
