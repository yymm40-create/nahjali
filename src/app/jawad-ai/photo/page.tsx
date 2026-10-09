import { notFound, redirect } from "next/navigation";
import PhotoHome from "@/components/jawad/photo/PhotoHome";
import { designerAllowed } from "@/lib/designer/access";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { photoAllowed } from "@/lib/photo/access";
import { listProjects } from "@/lib/photo/projects";
import { PHOTO } from "@config/photo";
import "./photo.css";

export const dynamic = "force-dynamic";
export const metadata = { title: PHOTO.name };

/** «زهراء فوتو ماستر»: the front page. The owner always; others by the owner's switch and the «photo» permission. */
export default async function PhotoPage() {
  const [{ user }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  if (!rt.sections.some((s) => s.implementation === "photo")) notFound();
  if (!user) redirect(jawadLogin(PHOTO.base));
  if (!(await photoAllowed(user.email))) notFound();
  const [projects, canDesigner] = await Promise.all([listProjects(user.id).catch(() => []), designerAllowed(user.email)]);
  return <PhotoHome projects={projects.map((p) => ({ id: p.id, title: p.title, from: p.source?.kind ?? null, updatedAt: p.updatedAt }))} persona={PHOTO.persona} canDesigner={canDesigner} />;
}
