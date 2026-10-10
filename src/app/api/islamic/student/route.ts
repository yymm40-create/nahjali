import { NextResponse } from "next/server";
import { handle, UserError } from "@/lib/api";
import { requireStudentApiUser } from "@/lib/jawad/server/access";
import { createProject } from "@/lib/jawad/student/actions";
import { sdb, touch } from "@/lib/jawad/student/db";
import { islamicName } from "@/lib/jawad/student/islamic";
import { STUDENT } from "@config/jawad/student";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * «الذكاء الإسلامي» → «الطالب الذكي»: an answer of the Islamic library becomes study material. Body:
 * `{ question, answer, sources?: [{n,title,source,url}] }` — a new material is made whose SOURCE is that answer with
 * its references, so صادق reads it, understands it, and makes a summary, a book, slides, a recording or a quiz from
 * it. Nothing is generated here and nothing is charged: the text already exists.
 */
export const POST = handle(async (req: Request) => {
  const { user } = await requireStudentApiUser();
  const b = (await req.json().catch(() => ({}))) as { question?: unknown; answer?: unknown; sources?: unknown };
  const question = String(b.question ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
  const answer = String(b.answer ?? "").trim().slice(0, 200_000);
  if (!answer) throw new UserError("ما فيه جواب أحوّله لمادة.");

  const refs = (Array.isArray(b.sources) ? b.sources : [])
    .slice(0, 60)
    .map((x) => (x ?? {}) as Record<string, unknown>)
    .map((s, i) => `[${Number(s.n) || i + 1}] ${String(s.title ?? "").slice(0, 200)}${s.source ? ` — ${String(s.source).slice(0, 120)}` : ""}${s.url ? ` — ${String(s.url).slice(0, 300)}` : ""}`)
    .join("\n");
  const body = `السؤال: ${question || "—"}\n\n${answer}${refs ? `\n\nالمصادر:\n${refs}` : ""}`;

  const id = await createProject(user, { title: question || "مادة من الذكاء الإسلامي", brief: { purpose: "understand", mode: "files", auto: true } });
  const row: Record<string, unknown> = {
    project_id: id,
    user_id: user.id,
    ord: 0,
    kind: "text",
    name: islamicName(question || "جواب"),
    body,
    mime: "text/plain",
    bytes: Buffer.byteLength(body),
    pages: 1,
    status: "ready",
    role: "material",
  };
  let { error } = await sdb().from("student_sources").insert(row);
  if (error) {
    // before migration 0050 there is no role column
    delete row.role;
    ({ error } = await sdb().from("student_sources").insert(row));
  }
  if (error) throw error;
  await touch(id);
  return NextResponse.json({ id, url: `${STUDENT.base}/${id}` });
});
