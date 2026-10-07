import { notFound } from "next/navigation";
import { can } from "@/lib/access";
import SectionClosed from "@/components/jawad/SectionClosed";
import EditorHome from "@/components/jawad/editor/EditorHome";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { listEditorProjects } from "@/lib/editor/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "حيدرة كت" };

/** «حيدرة كت»: the person's edits and a new one (for those «السماح» lets in; editing asks to sign in first). */
export default async function EditorPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "editor");
  if (!section || (!section.enabled && !owner)) notFound();
  if (user && !(await can(user.email, "editor"))) return <SectionClosed icon="✂️" name={section.name} />;
  const projects = user ? await listEditorProjects(user.id).catch(() => null) : [];
  return <EditorHome name={section.name} projects={projects} loginHref={user ? null : jawadLogin("/jawad-ai/editor")} />;
}
