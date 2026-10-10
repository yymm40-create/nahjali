import { notFound } from "next/navigation";
import KharqChat from "@/components/jawad/kharq/KharqChat";
import { kharqAllowed } from "@/lib/kharq/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { KHARQ } from "@config/kharq";
import "./kharq.css";

export const dynamic = "force-dynamic";
export const metadata = { title: KHARQ.name };

/** «محمد الخارق»: a general conversation with the ROCTCF builder behind it. The owner always; others by the switch. */
export default async function KharqPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "kharq");
  if (!section) notFound();
  if (!user) return <KharqChat name={section.name} loginHref={jawadLogin(KHARQ.base)} />;
  if (!owner && !(await kharqAllowed(user.email))) notFound();
  return <KharqChat name={section.name} loginHref={null} />;
}
