// «الطالب الذكي» — what every output is built on: the approved text, the approved understanding, the approved research
// (if the student asked for it) and the two source rules. Server only.

import { briefLine, readBrief } from "@config/jawad/student";
import { getProject, versionOf, type Output, type Project, type TextVersion } from "./db";
import type { Research } from "./research";
import type { Understanding } from "./understand";

export interface Ctx {
  project: Project;
  text: TextVersion;
  understanding: Understanding;
  research: Research | null;
  /** short id (8) → segment */
  seg: Map<string, { id: string; label: string; text: string }>;
}

export async function loadCtx(userId: string, projectId: string): Promise<Ctx> {
  const project = await getProject(userId, projectId);
  const [t, u, r] = await Promise.all([
    versionOf<TextVersion>(project.id, "text", project.text_version),
    versionOf<Understanding>(project.id, "understanding", project.understanding_version),
    project.web_search && project.research_version ? versionOf<Research>(project.id, "research", project.research_version) : Promise.resolve(null),
  ]);
  if (!t || !u) throw new Error("approved text / understanding missing");
  return { project, text: t.content, understanding: u.content, research: r?.content ?? null, seg: new Map(t.content.segments.map((s) => [s.id.slice(0, 8), s])) };
}

export const basedOn = (c: Ctx) => ({ text: c.project.text_version, understanding: c.project.understanding_version, research: c.project.research_version });

/** The student's two answers, as rules for the writer. */
export function scopeRules(c: Ctx) {
  const lines = [
    c.project.allow_additions
      ? "ADDITIONS ALLOWED: you may add explanations, examples or background from your own knowledge, but each such addition must be its own block of type \"addition\" (never mixed into the material's blocks), and must be accurate and suited to the level."
      : "MATERIAL ONLY: use only what is in the material. Do not add facts, examples, numbers, names or explanations that are not in it. Rephrasing and simplifying what IS in it is fine. Never output a block of type \"addition\".",
    c.research
      ? "RESEARCH: you may use the research paragraphs given (numbered sources). Anything taken from them must be its own block of type \"research\" listing the source numbers (0-based indexes as given). Never present research as part of the material."
      : "NO RESEARCH: never output a block of type \"research\".",
    "QUOTES: a block of type \"quote\" must copy words that really are in the material, exactly.",
    "Every block lists in \"segments\" the ids of the material's segments it comes from (empty for additions).",
  ];
  return lines.join("\n");
}

export const segText = (c: Ctx, ids: string[]) =>
  ids
    .map((id) => c.seg.get(id))
    .filter(Boolean)
    .map((s) => `<segment id="${s!.id.slice(0, 8)}" where="${s!.label}">\n${s!.text}\n</segment>`)
    .join("\n");

export const allText = (c: Ctx) => segText(c, [...c.seg.keys()]);
export const allChars = (c: Ctx) => c.text.segments.reduce((s, x) => s + x.text.length, 0);

export const researchText = (c: Ctx) =>
  c.research ? `<research>\n${c.research.paragraphs.map((p) => `${p.text} [sources: ${p.cites.join(", ")}]`).join("\n\n")}\n</research>` : "";

export const understandingText = (c: Ctx) =>
  `Topic: ${c.understanding.topic}\nKind: ${c.understanding.materialType}\nOverview: ${c.understanding.overview}\nSections:\n${c.understanding.sections.map((s) => `- ${s.title}: ${s.about} [segments: ${s.segments.join(", ")}]`).join("\n")}`;

export const levelLine = (c: Ctx, o: Output) =>
  `Student level: ${c.project.level || "unspecified"}. Audience: ${String(o.settings.audience ?? "") || c.project.audience || "the student"}. ${briefLine(readBrief(c.project.brief))}`;
