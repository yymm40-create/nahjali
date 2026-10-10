import { notFound } from "next/navigation";
import BookletHome from "@/components/jawad/booklet/BookletHome";
import { can } from "@/lib/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { TB } from "@config/tables-booklet";
import "./booklet.css";

export const dynamic = "force-dynamic";
export const metadata = { title: TB.name };

/** «كتيب الجداول الذكي»: who the booklet is for, then the ready booklet or tables designed with «نور». */
export default async function BookletPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "booklet");
  if (!section || (!section.enabled && !owner)) notFound();
  if (!user) return <BookletHome name={section.name} loginHref={jawadLogin(TB.base)} />;
  if (!owner && !(await can(user.email, "booklet"))) notFound();
  return <BookletHome name={section.name} loginHref={null} />;
}
