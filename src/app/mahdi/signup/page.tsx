import { redirect } from "next/navigation";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { t } from "@/lib/mahdi/i18n";
import SignupForm from "./SignupForm";

export const metadata = { title: t.auth.signup };

export default async function MahdiSignup() {
  const { user } = await getMahdiSession();
  if (user) redirect("/mahdi");
  return <SignupForm />;
}
