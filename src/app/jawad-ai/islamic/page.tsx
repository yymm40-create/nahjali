import { notFound } from "next/navigation";
import IslamicChat from "@/components/jawad/islamic/IslamicChat";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { ISLAMIC } from "@config/islamic";

export const dynamic = "force-dynamic";
export const metadata = { title: ISLAMIC.name };

/** «الذكاء الإسلامي»: questions answered from the library the owner feeds. In its private trial: the owner only. */
export default async function IslamicPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "islamic");
  if (!section || !owner) notFound();
  return <IslamicChat name={section.name} loginHref={user ? null : jawadLogin(ISLAMIC.base)} />;
}
