import { notFound } from "next/navigation";
import EditorHome from "@/components/jawad/editor/EditorHome";
import { jawadLogin, jawadSession } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { listEditorProjects } from "@/lib/editor/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الممنتج الذكي" };

/** «الممنتج الذكي»: the person's edits and a new one. Open to every visitor; editing asks to sign in first. */
export default async function EditorPage() {
  const [{ user, owner }, rt] = await Promise.all([jawadSession(), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "editor");
  if (!section || (!section.enabled && !owner)) notFound();
  const projects = user ? await listEditorProjects(user.id).catch(() => null) : [];
  return <EditorHome name={section.name} projects={projects} loginHref={user ? null : jawadLogin("/jawad-ai/editor")} />;
}
