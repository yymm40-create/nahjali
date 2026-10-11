// «الخطيب الذكي» — what «الشيخ» does next on his own journey (the preacher gave his topic and goal; nothing waits on him):
// the topic's text researched → read and understood → the sermon made with the request → the closest of the three topics
// taken → the tafsir from مجمع البيان → lines from the poetry references → stories from the sources → the plan approved →
// the text written and SHOWN to the preacher, who approves it before the PDF / Word are made. What is looked for and not found is marked by the server, and the journey goes on
// without it. Everything else is the student's autopilot (reading, understanding, a failed step tried again).

import { isResearchSource } from "@config/jawad/student";
import { sermonSettings } from "@config/jawad/khateeb";
import { nextAuto, type AutoAction } from "@/components/jawad/student/autopilot";
import { newKey, post, type OutputView, type ProjectState } from "@/components/jawad/student/client";
import type { SermonPlan } from "@/lib/jawad/student/model";

export const sermonOf = (o: OutputView | undefined) => (o?.plan as { sermon?: SermonPlan } | null)?.sermon ?? null;

export function nextKhateeb(s: ProjectState): AutoAction | null {
  const ask = s.project.brief.sermon;
  if (!ask) return nextAuto(s);
  const pid = s.project.id;
  const projectAct = (body: Record<string, unknown>) => post(`/api/jawad/student/projects/${pid}`, body);
  const outAct = (id: string, body: Record<string, unknown>) => post(`/api/jawad/student/outputs/${id}`, body);
  const outPaid = (id: string, body: Record<string, unknown>) => outAct(id, { ...body, confirm: true, key: newKey() });

  const stage = s.project.stage;
  if (stage === "sources" || stage === "review") {
    // the preacher's own sermon text IS the material; otherwise the Sheikh researches the topic's text on the web
    if (ask.draftText) {
      if (!s.sources.length) return { label: "يقرأ نصك", run: () => projectAct({ action: "source_text", body: ask.draftText, name: "نص الخطبة" }) };
    } else if (!s.sources.some((x) => isResearchSource(x.name))) {
      return { label: "يبحث في نصوص الموضوع", run: () => projectAct({ action: "research_material", focus: ask.topic, where: "", confirm: true, key: newKey() }) };
    }
  }
  if (stage !== "outputs") return nextAuto(s);

  const o = s.outputs.find((x) => x.kind === "sermon");
  if (!o) return { label: "يجهّز الخطبة", run: () => projectAct({ action: "start", outputs: [{ kind: "sermon", settings: sermonSettings(ask) }] }) };
  if (o.status === "plan_review") {
    const sp = sermonOf(o);
    if (!sp) return null;
    if (s.jobs.some((j) => j.outputId === o.id && (j.status === "queued" || j.status === "running"))) return null;
    if (sp.chosen < 0) return { label: "يعتمد موضوعك وآيته", run: () => outAct(o.id, { action: "sermon_choose", index: 0 }) };
    if (!sp.tafsir && !sp.tafsirMissing) return { label: "يجيب التفسير من مجمع البيان", run: () => outPaid(o.id, { action: "sermon_tafsir" }) };
    if (ask.poetryIds.length && sp.poems === undefined) return { label: "يبحث عن الأبيات في مراجع الشعر", run: () => outPaid(o.id, { action: "sermon_poems", refIds: ask.poetryIds }) };
    if (ask.sourceIds.length && sp.sources === undefined) return { label: "يبحث عن القصص والروايات في كتب المكتبة", run: () => outPaid(o.id, { action: "sermon_sources", refIds: ask.sourceIds }) };
    return { label: "يعتمد خطة الخطبة", run: () => outAct(o.id, { action: "plan_approve" }) };
  }
  // the written text waits for the preacher: he reads it, asks for changes, and approves it before its files are made
  if (o.status === "review" && (o.content as { draft?: boolean } | null)?.draft) return null;
  return nextAuto(s);
}
