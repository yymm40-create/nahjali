import { notFound, redirect } from "next/navigation";
import RidhaApp from "@/components/jawad/ridha/RidhaApp";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { RIDHA } from "@config/ridha";
import "./ridha.css";

export const dynamic = "force-dynamic";
export const metadata = { title: RIDHA.name };

/**
 * «الرضا فويس»: the sound studio. Everything in it runs on the person's device (no sound is uploaded; only the
 * conversation with «الرضا ماكس» uses the balance), so it has no permission of its own: the owner always; everyone else once the owner turns the section on
 * from the dashboard (it starts off, in its private trial).
 */
export default async function RidhaPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "ridha");
  if (!section) notFound();
  if (!user) redirect(jawadLogin(RIDHA.base));
  if (!owner && !section.enabled) notFound();
  return <RidhaApp />;
}
