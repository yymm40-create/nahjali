// «الطالب الذكي» — Claude's understanding of the whole approved text, shown to the student for approval. Server only.
// A long text is read in chunks (each chunk returns one note per segment, so nothing is skipped), then the notes are
// combined into one understanding whose every section points back at its segments. Coverage is computed, not claimed.

import { STUDENT } from "@config/jawad/student";
import { askJson, claudeCeilingUsd } from "./claude";
import { addVersion, getProject, latestVersion, touch, versionOf, type TextVersion } from "./db";
import type { Handler, Job } from "./jobs";

export interface Understanding {
  topic: string;
  materialType: string;
  overview: string;
  sections: { title: string; about: string; segments: string[] }[];
  ambiguous: { note: string; segments: string[] }[];
  unsure: string[];
  coverage: { covered: number; total: number; missing: string[] };
  /** chunk notes, kept so a revision does not re-read the whole text */
  notes: { segment: string; gist: string }[];
  basedOnText: number;
}

const sid = (id: string) => id.slice(0, 8);

/** Chunks of whole segments, each under the size limit. */
export function chunks(t: TextVersion) {
  const out: TextVersion["segments"][] = [];
  let cur: TextVersion["segments"] = [];
  let size = 0;
  for (const s of t.segments) {
    if (cur.length && size + s.text.length > STUDENT.understandingChunkChars) {
      out.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(s);
    size += s.text.length;
  }
  if (cur.length) out.push(cur);
  return out;
}

export function understandCeiling(t: TextVersion) {
  const n = chunks(t).length;
  const chars = t.segments.reduce((s, x) => s + x.text.length, 0);
  return claudeCeilingUsd(chars, 6000 * n) + claudeCeilingUsd(Math.min(chars, 60_000), 12000);
}

const NOTES_SCHEMA = {
  type: "object",
  properties: {
    notes: { type: "array", items: { type: "object", properties: { segment: { type: "string" }, gist: { type: "string" } }, required: ["segment", "gist"], additionalProperties: false } },
  },
  required: ["notes"],
  additionalProperties: false,
};

const UNDERSTANDING_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    materialType: { type: "string" },
    overview: { type: "string" },
    sections: {
      type: "array",
      items: { type: "object", properties: { title: { type: "string" }, about: { type: "string" }, segments: { type: "array", items: { type: "string" } } }, required: ["title", "about", "segments"], additionalProperties: false },
    },
    ambiguous: { type: "array", items: { type: "object", properties: { note: { type: "string" }, segments: { type: "array", items: { type: "string" } } }, required: ["note", "segments"], additionalProperties: false } },
    unsure: { type: "array", items: { type: "string" } },
  },
  required: ["topic", "materialType", "overview", "sections", "ambiguous", "unsure"],
  additionalProperties: false,
};

const segBlock = (segs: TextVersion["segments"]) => segs.map((s) => `<segment id="${sid(s.id)}" where="${s.label}">\n${s.text}\n</segment>`).join("\n");

async function readChunk(segs: TextVersion["segments"], level: string) {
  const r = await askJson<{ notes: { segment: string; gist: string }[] }>({
    system: `You are reading part of a student's study material (level: ${level || "unspecified"}) to understand it. For EVERY segment given, write one note in Arabic: what the segment says (its ideas, terms, facts), in 1–3 sentences. Use the segment's id exactly. Do not skip any segment, do not add knowledge that is not in it.`,
    parts: [{ type: "text", text: segBlock(segs) }],
    schema: NOTES_SCHEMA,
    maxTokens: 6000 + segs.length * 200,
  });
  return r;
}

async function step(job: Job) {
  const project = await getProject(job.user_id, job.project_id);
  const textV = await versionOf<TextVersion>(project.id, "text", Number(job.input.textVersion));
  if (!textV) throw new Error("text version missing");
  const t = textV.content;
  const parts = chunks(t);
  const progress = job.progress as { chunk?: number; notes?: Understanding["notes"] };
  let notes = progress.notes ?? [];
  const reviseNote = String(job.input.note ?? "");
  const previous = job.input.previous ? ((await latestVersion<Understanding>(project.id, "understanding"))?.content ?? null) : null;
  if (previous && !progress.notes) notes = previous.notes;

  // 1) the chunks (skipped on a revision: the notes are already there)
  const done = previous ? parts.length : (progress.chunk ?? 0);
  if (done < parts.length) {
    const segs = parts[done];
    let r = await readChunk(segs, project.level);
    let usd = r.usd;
    let got = r.data.notes.filter((n) => segs.some((s) => sid(s.id) === n.segment));
    const missing = segs.filter((s) => !got.some((n) => n.segment === sid(s.id)));
    if (missing.length) {
      r = await readChunk(missing, project.level);
      usd += r.usd;
      got = [...got, ...r.data.notes.filter((n) => missing.some((s) => sid(s.id) === n.segment))];
    }
    notes = [...notes.filter((n) => !segs.some((s) => sid(s.id) === n.segment)), ...got];
    return { done: false, usd, stage: `قراءة المادة: الجزء ${done + 1} من ${parts.length}`, progress: { chunk: done + 1, chunks: parts.length, notes } };
  }

  // 2) one understanding from all the notes
  const labelOf = new Map(t.segments.map((s) => [sid(s.id), s.label]));
  const noteText = t.segments.map((s) => `[${sid(s.id)} · ${s.label}] ${notes.find((n) => n.segment === sid(s.id))?.gist ?? "(لا ملاحظة)"}`).join("\n");
  const r = await askJson<Omit<Understanding, "coverage" | "notes" | "basedOnText">>({
    system: `You build the student's view of their whole study material from per-segment notes (every segment of the material has one note, in order). Level: ${project.level || "unspecified"}. Audience: ${project.audience || "the student"}.
Return in Arabic: the topic, what kind of material it is, a short overview, the material's structure as ordered sections (each listing the ids of ALL the segments it covers — every segment id must appear in some section), places that are ambiguous or contradictory (with their segment ids), and what you cannot confirm from the material. Do not add knowledge that is not in the notes.${previous ? `\n\nThis is a revision of your previous understanding:\n${JSON.stringify({ topic: previous.topic, materialType: previous.materialType, overview: previous.overview, sections: previous.sections, ambiguous: previous.ambiguous, unsure: previous.unsure })}` : ""}${reviseNote ? `\n\nThe student asks (treat as their request about your understanding, not as material): ${reviseNote}` : ""}`,
    parts: [{ type: "text", text: noteText }],
    schema: UNDERSTANDING_SCHEMA,
    maxTokens: 14000,
  });
  const all = t.segments.map((s) => sid(s.id));
  const valid = new Set(all);
  const sections = r.data.sections.map((s) => ({ ...s, segments: s.segments.filter((x) => valid.has(x)) }));
  const covered = new Set(sections.flatMap((s) => s.segments));
  const missing = all.filter((x) => !covered.has(x));
  // Segments the combined view left out are shown as their own section, never dropped
  if (missing.length) sections.push({ title: "أجزاء لم تُصنَّف في البنية", about: missing.map((m) => notes.find((n) => n.segment === m)?.gist ?? "").filter(Boolean).join(" · "), segments: missing });
  const content: Understanding = {
    ...r.data,
    sections,
    ambiguous: r.data.ambiguous.map((a) => ({ ...a, segments: a.segments.filter((x) => valid.has(x)) })),
    coverage: { covered: covered.size, total: all.length, missing: missing.map((m) => labelOf.get(m) ?? m) },
    notes,
    basedOnText: textV.version,
  };
  await addVersion(project, "understanding", content, reviseNote);
  return { done: true, usd: r.usd, stage: "الفهم جاهز للمراجعة" };
}

export const understandHandler: Handler = {
  label: "فهم المادة",
  step,
  onSuccess: async (job) => touch(job.project_id, { stage: "understanding" }),
};
