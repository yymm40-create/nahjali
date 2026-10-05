// «الطالب الذكي» — web research about the material's topic (only when the student asked for it), with Anthropic's web
// search tool. Every paragraph keeps the sources the API cited for it; the research never changes the approved text.

import { STUDENT } from "@config/jawad/student";
import { claudeCeilingUsd, webResearch, type ResearchParagraph, type ResearchSource } from "./claude";
import { addVersion, getProject, versionOf } from "./db";
import type { Handler, Job } from "./jobs";
import type { Understanding } from "./understand";

export interface Research {
  question: string;
  paragraphs: ResearchParagraph[];
  sources: ResearchSource[];
  searches: number;
  basedOnUnderstanding: number;
}

export const researchCeiling = () => claudeCeilingUsd(60_000, 12000) * 2 + STUDENT.maxSearches * STUDENT.webSearchUsd;

async function step(job: Job) {
  const project = await getProject(job.user_id, job.project_id);
  const u = await versionOf<Understanding>(project.id, "understanding", project.understanding_version);
  if (!u) throw new Error("no approved understanding");
  const focus = String(job.input.focus ?? "").trim();
  const question = `الموضوع: ${u.content.topic}\nنوع المادة: ${u.content.materialType}\nأقسامها: ${u.content.sections.map((s) => s.title).join("، ")}\nالمستوى: ${project.level || "غير محدد"}${focus ? `\nما يريده الطالب من البحث: ${focus}` : ""}`;
  const r = await webResearch({
    system: `You research a study topic on the web for a student, to complement (never replace) their own material. Search reliable sources (encyclopaedias, universities, official bodies, reputable publishers) — prefer Arabic sources when good ones exist. Write in Arabic, in short paragraphs separated by blank lines: what the sources add (definitions, context, recent facts, examples), and where sources disagree with each other. Every factual sentence must come from a source you found; if you find nothing reliable, say so plainly. Do not repeat what the material already says at length.`,
    question,
  });
  const content: Research = { question, paragraphs: r.paragraphs, sources: r.sources, searches: r.searches, basedOnUnderstanding: u.version };
  await addVersion(project, "research", content, focus);
  return { done: true, usd: r.usd, stage: r.sources.length ? `وُجد ${r.sources.length} مصدرًا` : "لم يُعثر على مصادر" };
}

export const researchHandler: Handler = { label: "البحث الخارجي", step };
