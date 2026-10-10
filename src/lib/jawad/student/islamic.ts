// «الطالب الذكي» ↔ «الذكاء الإسلامي» — the bridge between them, both ways.
//
// FROM صادق: when the material is religious — a verse, a narration, a ruling, a point of belief, the life of the
// Prophet and his household — صادق does not write it from his own head and does not go searching the open web for
// it. He ASKS «الذكاء الإسلامي», which answers only from the owner's own trained library with its sources, and the
// answer comes back as a written source of the project (named «الذكاء الإسلامي: …», with its own reference list), so
// everything built afterwards — the summary, the book, the slides, the quiz — stands on it and quotes it.
//
// TO صادق: any answer of «الذكاء الإسلامي» can be turned into study material with one press («🎓 اعمل منها مادة
// دراسية»): a new project is made whose material is that answer and its sources, and the student goes on from there.
//
// Server only. The Islamic side is `src/lib/islamic/ask.ts`; nothing here talks to a provider by itself.

import { UserError } from "@/lib/api";
import { ask, type Answer } from "@/lib/islamic/ask";
import { isIslamicMode, type IslamicMode } from "@/lib/islamic/text";
import { ISLAMIC_PREFIX } from "@config/jawad/student";
import { claudeCeilingUsd } from "./claude";
import { sdb, sources, touch } from "./db";
import type { Handler, Job } from "./jobs";

/** What one ask of «الذكاء الإسلامي» may cost us at most (a deep research is the dearest way it answers). */
export const islamicCeiling = (mode: IslamicMode) => (mode === "research" ? claudeCeilingUsd(90_000, 16000) * 2 : claudeCeilingUsd(40_000, 8000));

/** The question as it is sent over, and how it is answered. */
export function islamicAsk(b: Record<string, unknown>): { question: string; mode: IslamicMode } {
  const question = String(b.question ?? "").replace(/\s+/g, " ").trim().slice(0, 2000);
  if (!question) throw new UserError("اكتب سؤالك للذكاء الإسلامي.");
  return { question, mode: isIslamicMode(b.mode) ? b.mode : "auto" };
}

/** The answer written as the project's material: the answer itself, then the passages it stands on. */
export function islamicBody(a: Answer): string {
  const refs = a.sources.map((s) => `[${s.n}] ${s.title}${s.source ? ` — ${s.source}` : ""}${s.url ? ` — ${s.url}` : ""}`).join("\n");
  const head = a.found ? "" : "⚠️ الذكاء الإسلامي ما لقى في مكتبته ما يجيب على هذا السؤال؛ هذا اللي وجده:\n\n";
  return `${head}${a.answer.trim()}${refs ? `\n\nالمصادر:\n${refs}` : ""}`;
}

/** The name the source carries, so the page and the writer both know where it came from. */
export const islamicName = (question: string) => `${ISLAMIC_PREFIX}: ${question.slice(0, 120)}`;

/**
 * One ask, written into the project as a source. The role is «مادة علمية» when the student has nothing else yet, and
 * «مرجع إضافي» when they already brought their own material (so the religious answer supports it, not replaces it).
 */
export async function askIslamicInto(userId: string, projectId: string, question: string, mode: IslamicMode, email: string | null): Promise<{ usd: number; found: boolean; sources: number }> {
  const a = await ask(userId, question, [], email, mode);
  const body = islamicBody(a);
  const list = await sources(projectId);
  const role = list.some((s) => !s.name.startsWith(ISLAMIC_PREFIX)) ? "reference" : "material";
  const row: Record<string, unknown> = {
    project_id: projectId,
    user_id: userId,
    ord: list.length,
    kind: "text",
    name: islamicName(question),
    body,
    mime: "text/plain",
    bytes: Buffer.byteLength(body),
    pages: 1,
    status: "ready",
    role,
  };
  let { error } = await sdb().from("student_sources").insert(row);
  if (error) {
    // before migration 0050 there is no role column: the source is still written, as material
    delete row.role;
    ({ error } = await sdb().from("student_sources").insert(row));
  }
  if (error) throw error;
  await touch(projectId);
  return { usd: a.usd, found: a.found, sources: a.sources.length };
}

export const islamicHandler: Handler = {
  label: "سؤال الذكاء الإسلامي",
  async step(job: Job) {
    const question = String(job.input.question ?? "").trim();
    const mode: IslamicMode = isIslamicMode(job.input.mode) ? (job.input.mode as IslamicMode) : "auto";
    if (!question) throw new Error("no question");
    const r = await askIslamicInto(job.user_id, job.project_id, question, mode, String(job.input.email ?? "") || null);
    return { done: true, usd: r.usd, stage: r.found ? `جاوب من ${r.sources} مصدرًا` : "ما لقى جوابًا في المكتبة" };
  },
};
