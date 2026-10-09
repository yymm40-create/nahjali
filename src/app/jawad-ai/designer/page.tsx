import { notFound } from "next/navigation";
import DesignerChat from "@/components/jawad/designer/DesignerChat";
import { designerAllowed } from "@/lib/designer/access";
import { photoAllowed } from "@/lib/photo/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { DESIGNER } from "@config/designer";
import "./designer.css";

export const dynamic = "force-dynamic";
export const metadata = { title: DESIGNER.name };

/** «المصمم الذكي»: a chat with «كاظم». The owner always; others by the owner's switch and the «designer» permission. */
export default async function DesignerPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const { chat } = await searchParams;
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "designer");
  if (!section) notFound();
  if (!user) return <DesignerChat name={section.name} persona={DESIGNER.persona} loginHref={jawadLogin(DESIGNER.base)} />;
  if (!owner && !(await designerAllowed(user.email))) notFound();
  return <DesignerChat name={section.name} persona={DESIGNER.persona} loginHref={null} owner={owner} photo={await photoAllowed(user.email)} initialChat={typeof chat === "string" && /^[0-9a-f-]{36}$/i.test(chat) ? chat : null} />;
}
