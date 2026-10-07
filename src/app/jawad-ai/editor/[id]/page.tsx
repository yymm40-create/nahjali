import { notFound } from "next/navigation";
import { can } from "@/lib/access";
import SectionClosed from "@/components/jawad/SectionClosed";
import Editor from "@/components/jawad/editor/Editor";
import { UserError } from "@/lib/api";
import { requireJawadUser } from "@/lib/jawad/server/access";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { exportLink, projectState, requireEditorProject } from "@/lib/editor/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "حيدرة كت" };

/** One edit. Only its owner can open it. */
export default async function EditorProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ user, owner }, rt] = await Promise.all([requireJawadUser(`/jawad-ai/editor/${id}`), loadRuntime()]);
  const section = rt.sections.find((s) => s.implementation === "editor");
  if (!section || (!section.enabled && !owner)) notFound();
  if (!(await can(user.email, "editor"))) return <SectionClosed icon="✂️" name={section.name} />;
  const p = await requireEditorProject(id, user.id).catch((e) => {
    if (e instanceof UserError) return null;
    throw e;
  });
  if (!p) notFound();
  const [state, exportUrl] = await Promise.all([projectState(p), exportLink(p)]);
  const backHref = p.film_project_id ? `/jawad-ai/film/${p.film_project_id}/edit` : "/jawad-ai/editor";
  // the videos page, where «التعديل الذكي» jobs are listed while they are made
  const studio = rt.sections.find((s) => s.output === "video" && (s.enabled || owner));
  return <Editor project={JSON.parse(JSON.stringify(state.project))} initialAssets={state.assets} exportUrl={exportUrl} backHref={backHref} studioPath={studio?.path ?? null} owner={owner} />;
}
