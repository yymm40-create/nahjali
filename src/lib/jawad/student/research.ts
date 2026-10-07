// «الطالب الذكي» — web research about the material's topic (only when the student asked for it), with Anthropic's web
// search tool. Every paragraph keeps the sources the API cited for it; the research never changes the approved text.

import { STUDENT, briefLine, readBrief, researchPlaces } from "@config/jawad/student";
import { claudeCeilingUsd, webResearch, type ResearchParagraph, type ResearchSource } from "./claude";
import { addVersion, getProject, sdb, sources, touch, versionOf } from "./db";
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

/**
 * «كلاود يبحث لي»: no files — the research IS the material. It becomes a written source («بحث كلاود») with its sources
 * listed, and goes through the same reading and understanding as anything the student types.
 */
async function asMaterial(job: Job) {
  const project = await getProject(job.user_id, job.project_id);
  const brief = readBrief(project.brief);
  const focus = String(job.input.focus ?? "").trim() || brief.focus;
  const where = String(job.input.where ?? "").trim() || brief.where;
  const places = researchPlaces(where);
  const question = `الموضوع / المادة: ${project.title}\nالمستوى أو الصف: ${project.level || "غير محدد"}\nالفئة: ${project.audience || "الطالب نفسه"}\n${briefLine(brief)}${focus ? `\nالمعلومات المطلوبة: ${focus}` : ""}${where ? `\nوين يبحث (التزم بها): ${where}` : ""}`;
  const keepTo = places.links.length
    ? ` The student gave these pages: read them first (web_fetch) and build the material from them: ${places.links.join(" ")}. Search only within their sites (${places.sites.join(", ")}) when they don't cover something; never use other sites.`
    : where
      ? ` The student said where to look: «${where}». Keep to those sources (that site, curriculum, book or body); if they can't be found, say so instead of using other sources.`
      : "";
  const r = await webResearch({
    system: `You research a study topic on the web and write it up as the student's study material, for exactly this level and purpose. Search reliable sources (encyclopaedias, ministries of education and curricula, universities, official bodies, reputable publishers) — prefer Arabic sources when good ones exist, and the student's curriculum when the level names one.${keepTo} Write in Arabic: a clear title line, then the topic organised in short sections (a heading line, then paragraphs), covering what this level needs — definitions, key ideas, steps, examples, numbers — separated by blank lines. Every factual sentence must come from a source you found; if you find nothing reliable on a part, say so plainly instead of filling it.`,
    question,
    allowedDomains: places.sites,
    fetch: places.links.length > 0,
  });
  if (!r.paragraphs.length) throw new Error("research found nothing");
  const cited = r.paragraphs.map((p) => `${p.text}${p.cites.length ? ` [${p.cites.map((i) => i + 1).join("، ")}]` : ""}`).join("\n\n");
  const refs = r.sources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`).join("\n");
  const body = `${cited}${refs ? `\n\nالمصادر:\n${refs}` : ""}`;
  const ord = (await sources(project.id)).length;
  const { error } = await sdb()
    .from("student_sources")
    .insert({ project_id: project.id, user_id: job.user_id, ord, kind: "text", name: `بحث كلاود: ${(focus || project.title).slice(0, 120)}`, body, mime: "text/plain", bytes: Buffer.byteLength(body), pages: 1, status: "ready" });
  if (error) throw error;
  await touch(project.id);
  return { done: true, usd: r.usd, stage: r.sources.length ? `كتب المادة من ${r.sources.length} مصدرًا` : "لم يُعثر على مصادر" };
}

async function step(job: Job) {
  if (job.input.asMaterial) return asMaterial(job);
  const project = await getProject(job.user_id, job.project_id);
  const u = await versionOf<Understanding>(project.id, "understanding", project.understanding_version);
  if (!u) throw new Error("no approved understanding");
  const brief = readBrief(project.brief);
  const focus = String(job.input.focus ?? "").trim() || brief.focus;
  const question = `الموضوع: ${u.content.topic}\nنوع المادة: ${u.content.materialType}\nأقسامها: ${u.content.sections.map((s) => s.title).join("، ")}\nالمستوى: ${project.level || "غير محدد"}\n${briefLine(brief)}${focus ? `\nما يريده الطالب من البحث: ${focus}` : ""}`;
  const r = await webResearch({
    system: `You research a study topic on the web for a student, to complement (never replace) their own material. Search reliable sources (encyclopaedias, universities, official bodies, reputable publishers) — prefer Arabic sources when good ones exist. Write in Arabic, in short paragraphs separated by blank lines: what the sources add (definitions, context, recent facts, examples), and where sources disagree with each other. Every factual sentence must come from a source you found; if you find nothing reliable, say so plainly. Do not repeat what the material already says at length.`,
    question,
  });
  const content: Research = { question, paragraphs: r.paragraphs, sources: r.sources, searches: r.searches, basedOnUnderstanding: u.version };
  await addVersion(project, "research", content, focus);
  return { done: true, usd: r.usd, stage: r.sources.length ? `وُجد ${r.sources.length} مصدرًا` : "لم يُعثر على مصادر" };
}

export const researchHandler: Handler = { label: "البحث الخارجي", step };
