import { redirect } from "next/navigation";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { getShrines } from "@/lib/mahdi/server/snapshot";
import { t } from "@/lib/mahdi/i18n";
import Onboarding from "./Onboarding";

export const metadata = { title: t.onboarding.welcomeTitle };

/** First visit after creating an account: name, shrine, look, then the first project. */
export default async function WelcomePage() {
  const { user, profile } = await getMahdiSession();
  if (!user) redirect("/mahdi/start");
  if (profile) redirect("/mahdi");
  const meta = user.user_metadata ?? {};
  const suggested = typeof meta.full_name === "string" ? meta.full_name.split(" ")[0] : typeof meta.name === "string" ? meta.name.split(" ")[0] : "";
  return <Onboarding shrines={await getShrines()} suggestedName={suggested.slice(0, 30)} />;
}
