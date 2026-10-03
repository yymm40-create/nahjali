import { redirect } from "next/navigation";
import { getMahdiSession } from "@/lib/mahdi/server/session";
import { getUsername, suggestionFor } from "@/lib/username";
import { t } from "@/lib/mahdi/i18n";
import UsernameGate from "./UsernameGate";

export const metadata = { title: t.username.gateTitle };
export const dynamic = "force-dynamic";

/** «لأجل المهدي» can't be used until the account has a username (shown only when the existing name is taken). */
export default async function MahdiUsernamePage() {
  const { supabase, user, profile } = await getMahdiSession();
  if (!user) redirect("/mahdi/start");
  if (await getUsername(supabase, user.id)) redirect("/mahdi");
  return <UsernameGate suggestion={suggestionFor(user, [profile?.displayName])} />;
}
