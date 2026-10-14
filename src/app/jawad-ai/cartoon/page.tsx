import { notFound } from "next/navigation";
import CartoonStudio from "@/components/jawad/cartoon/CartoonStudio";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import "./cartoon.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "حولني الى الستايل الكرتوني" };
export default async function CartoonPage() {
  const { user, allowed, owner } = await requireJawadUser("/jawad-ai/cartoon");
  const rt = await loadRuntime();
  const section = rt.sections.find(section => section.implementation === "cartoon");
  if (!allowed || !section || (!section.enabled && !owner)) notFound();
  return <CartoonStudio userId={user.id} />;
}

