import { after } from "next/server";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, totalTokens, type ClaudeTurn } from "./anthropic";
import { currentClaude, withClaude } from "./claude-model";
import { failJob, JOB_STALE_MS, startJob, succeedJob } from "./usage";
import type { FilmJob, FilmProject } from "./types";
import { readResearch, researchText } from "./research";
import { watchAfterScreenplay } from "./watch";
import { screenplayImpact } from "./impact";
import {
  APP_INTEGRATION,
  KIND_ORDER,
  SCREENWRITER_PROMPT,
  SCREENWRITER_SCHEMA,
  STAGE_KIND,
  type ScriptKind,
} from "@config/film-prompts/screenwriter";
import { filmKind, readFilmKind } from "@config/film";

const STAGE = "screenwriter";
const SYSTEM = `${SCREENWRITER_PROMPT}\n\n${APP_INTEGRATION}`;
/** Reserved per assistant reply; the real cost replaces it (a long screenplay can cost more). */
const ESTIMATE_USD = 0.6;
const MAX_TOKENS = 32000;
export const REVISION_MAX = 4000;

export interface ScriptReply {
  stage: number;
  content: string;
  notes: string;
  questions: { question: string; options: string[] }[];
}

export interface ScriptVersion {
  id: string;
  kind: ScriptKind;
  version: number;
  body: string;
  data: { notes?: string; questions?: ScriptReply["questions"]; answers?: string[] };
  status: "draft" | "awaiting_approval" | "approved" | "superseded";
  stale: boolean;
  created_at: string;
  approved_at: string | null;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

const db = () => createAdminClient();

/** The user's first message: their own story, facts and duration, exactly as they wrote them. */
export function storyMessage(p: FilmProject) {
  const kind = filmKind(readFilmKind((p as { kind?: unknown }).kind))!;
  const parts = [`نوع العمل: ${kind.ar}`, kind.brief, "", `عنوان المشروع: ${p.title}`, "", p.story];
  if (p.fixed_facts) parts.push("", "أشياء ثابتة لا تتغير:", p.fixed_facts);
  if (p.target_duration_sec) parts.push("", `مدة تقريبية: ${p.target_duration_sec} ثانية`);
  // what سجاد found and the person approved
  const research = researchText(readResearch(p.research));
  if (research) parts.push("", research);
  return parts.join("\n");
}

async function messages(projectId: string) {
  const { data } = await db()
    .from("film_messages")
    .select("id,role,content,created_at")
    .eq("project_id", projectId)
    .eq("stage", STAGE)
    .order("created_at", { ascending: true });
  return (data ?? []) as Message[];
}

export async function scriptVersions(projectId: string) {
  const { data } = await db()
    .from("film_versions")
    .select("id,kind,version,body,data,status,stale,created_at,approved_at")
    .eq("project_id", projectId)
    .eq("stage", STAGE)
    .order("version", { ascending: true });
  return (data ?? []) as ScriptVersion[];
}

/** The latest screenwriter job; a job stuck "running" past the time limit is failed (and released). */
export async function latestScriptJob(projectId: string): Promise<FilmJob | null> {
  const { data } = await db()
    .from("film_jobs")
    .select("*")
    .eq("project_id", projectId)
    .eq("operation", STAGE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const job = (data as FilmJob) ?? null;
  if (job?.status === "running" && Date.now() - new Date(job.started_at ?? job.created_at).getTime() > JOB_STALE_MS) {
    await failJob(job.id, "انتهى وقت الطلب قبل ما يكمل الرد");
    return { ...job, status: "failed", error: "انتهى وقت الطلب قبل ما يكمل الرد" };
  }
  return job;
}

export type ScriptAction =
  | { action: "start" }
  | { action: "approve"; versionId: string }
  | { action: "answers"; versionId: string; answers: string[] }
  | { action: "revise"; text: string; versionId?: string; mode?: "edit" | "direct" }
  | { action: "retry" };

/**
 * Applies one user action, then (except for approving the final handoff) queues the next
 * assistant reply in the background. Returns the job id, or null when nothing is generated.
 */
export async function scriptAction(project: FilmProject, user: { id: string; email?: string | null }, input: ScriptAction) {
  const job = await latestScriptJob(project.id);
  if (job?.status === "running") throw new UserError("السيناريست يكتب ردّه الحين، انتظر شوي.", 409);

  const msgs = await messages(project.id);
  const versions = await scriptVersions(project.id);
  const latestOf = (kind: ScriptKind) => versions.filter((v) => v.kind === kind).at(-1);

  let userText: string | null = null;

  switch (input.action) {
    case "start": {
      if (msgs.length > 0) throw new UserError("المحادثة مع السيناريست بدأت من قبل.", 409);
      if (project.story.trim().length < 10) throw new UserError("اكتب قصتك أول (ولو بأسطر قليلة).", 400);
      userText = storyMessage(project);
      break;
    }
    case "approve": {
      const v = versions.find((x) => x.id === input.versionId);
      if (!v || v.status !== "awaiting_approval" || latestOf(v.kind)?.id !== v.id) {
        throw new UserError("«اعتمد» يعتمد آخر نسخة معروضة بس. حدّث الصفحة وجرّب.", 409);
      }
      // «الرجوع الذكي»: a screenplay approved again while sheets or shots exist → سجاد lists what the change reaches
      const again = v.kind === "screenplay" && project.stage !== "screenwriter" && versions.some((x) => x.kind === "screenplay" && x.id !== v.id && x.status === "approved");
      await approve(project.id, v, versions);
      if (again) after(() => screenplayImpact(project, user));
      if (v.kind === "handoff") {
        // The approved handoff unlocks the sheet maker (a project already past it stays where it is)
        if (project.stage === "screenwriter") await db().from("film_projects").update({ stage: "sheets" }).eq("id", project.id);
        // a scene of a series: سجاد checks its continuity with the scenes around it
        after(() => watchAfterScreenplay(project.id));
        return null;
      }
      userText = "اعتمد";
      break;
    }
    case "answers": {
      const v = versions.find((x) => x.id === input.versionId);
      if (!v || v.kind !== "questions" || latestOf("questions")?.id !== v.id || v.status !== "awaiting_approval") {
        throw new UserError("هذي الأسئلة مو آخر نسخة. حدّث الصفحة.", 409);
      }
      const qs = v.data.questions ?? [];
      const answers = input.answers.map((a) => String(a ?? "").trim().slice(0, 1500));
      if (answers.length !== qs.length || answers.some((a) => !a)) throw new UserError("جاوب على كل الأسئلة.", 400);
      userText = ["إجاباتي:", ...answers.map((a, i) => `${i + 1}. ${a}`)].join("\n");
      await db()
        .from("film_versions")
        .update({ status: "approved", approved_at: new Date().toISOString(), data: { ...v.data, answers } })
        .eq("id", v.id);
      break;
    }
    case "revise": {
      const text = String(input.text ?? "").trim();
      if (!text) throw new UserError("اكتب وش تبي يتعدّل.", 400);
      if (text.length > REVISION_MAX) throw new UserError("طلب التعديل طويل.", 400);
      // Changing an already-approved deliverable: everything approved after it may now be out of date
      const target = input.versionId ? versions.find((x) => x.id === input.versionId) : undefined;
      if (target?.status === "approved") await markLaterStale(project.id, target.kind, versions);
      // A new direction is sent as such; an edit is the user's words as they are
      userText = input.mode === "direct" ? `توجيه / أمر جديد:\n${text}` : `تعديل:\n${text}`;
      break;
    }
    case "retry": {
      const last = msgs.at(-1);
      if (!last || last.role !== "user" || job?.status !== "failed") throw new UserError("ما فيه شي يحتاج إعادة.", 409);
      break;
    }
  }

  let lastUserId: string;
  if (userText !== null) {
    const { data, error } = await db()
      .from("film_messages")
      .insert({ project_id: project.id, stage: STAGE, role: "user", content: userText })
      .select("id")
      .single();
    if (error) throw error;
    lastUserId = data.id;
  } else {
    lastUserId = msgs.at(-1)!.id;
  }

  // One job per user message (+ a numbered key for each retry), so a double click never pays twice
  const { count } = await db().from("film_jobs").select("id", { count: "exact", head: true }).like("idempotency_key", `${lastUserId}%`);
  const key = count ? `${lastUserId}:retry${count}` : lastUserId;
  const { job: newJob, created } = await startJob({
    projectId: project.id,
    user,
    service: "anthropic",
    operation: STAGE,
    idempotencyKey: key,
    estimateUsd: ESTIMATE_USD,
    units: 0,
    unit: "tokens",
  });
  if (created) { const picked = currentClaude().id; after(() => withClaude(picked, () => runScriptJob(project.id, newJob.id))); };
  return newJob.id;
}

async function approve(projectId: string, v: ScriptVersion, versions: ScriptVersion[]) {
  const now = new Date().toISOString();
  // An older approved copy of the same deliverable is replaced by this one
  const older = versions.filter((x) => x.kind === v.kind && x.id !== v.id && x.status === "approved").map((x) => x.id);
  if (older.length) await db().from("film_versions").update({ status: "superseded" }).in("id", older);
  await db().from("film_versions").update({ status: "approved", approved_at: now, stale: false }).eq("id", v.id);
  if (older.length) await markLaterStale(projectId, v.kind, versions);
}

/** Flags approved deliverables that come after `kind` as possibly out of date (never changed silently). */
async function markLaterStale(projectId: string, kind: ScriptKind, versions: ScriptVersion[]) {
  const later = KIND_ORDER.slice(KIND_ORDER.indexOf(kind) + 1);
  const ids = versions.filter((x) => later.includes(x.kind) && x.status === "approved").map((x) => x.id);
  if (ids.length) await db().from("film_versions").update({ stale: true }).in("id", ids);
  // Later stages (sheets, director…) read the handoff; they are flagged from their own pages
  void projectId;
}

/** Background: sends the whole stage conversation to Claude and stores the reply as a new version. */
export async function runScriptJob(projectId: string, jobId: string) {
  try {
    const msgs = await messages(projectId);
    // Merge back-to-back messages of the same side (e.g. a correction sent after a failed reply)
    const turns: ClaudeTurn[] = [];
    for (const m of msgs) {
      const last = turns.at(-1);
      if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`;
      else turns.push({ role: m.role, content: m.content });
    }
    if (turns.at(-1)?.role !== "user") throw new Error("nothing to answer");

    let usage;
    let result;
    try {
      result = await callClaudeJson<ScriptReply>({ system: SYSTEM, turns, schema: SCREENWRITER_SCHEMA, maxTokens: MAX_TOKENS });
      usage = result.usage;
    } catch (err) {
      await failJob(jobId, err);
      return;
    }

    const reply = result.data;
    let kind = STAGE_KIND[reply.stage];
    if (!kind) throw new Error(`unexpected stage ${reply.stage}`);
    // After «اعتمد» the reply is the NEXT deliverable, whatever stage it labels itself with: resending the approved
    // stage would push the user's approval into the old copies and show the same step again
    if (msgs.filter((m) => m.role === "user").at(-1)?.content.trim() === "اعتمد") {
      const done = (await scriptVersions(projectId))
        .filter((v) => v.status === "approved" && v.kind !== "handoff")
        .sort((a, b) => String(a.approved_at ?? "").localeCompare(String(b.approved_at ?? "")))
        .at(-1);
      if (done && KIND_ORDER.indexOf(kind) <= KIND_ORDER.indexOf(done.kind)) kind = KIND_ORDER[KIND_ORDER.indexOf(done.kind) + 1] ?? kind;
    }

    const client = db();

    const versions = await scriptVersions(projectId);
    const same = versions.filter((v) => v.kind === kind);
    const pending = same
      .filter((v) => v.status === "awaiting_approval" || v.status === "draft" || (kind === "handoff" && v.status === "approved"))
      .map((v) => v.id);
    if (pending.length) await client.from("film_versions").update({ status: "superseded" }).in("id", pending);
    // The handoff works in the background: it is kept (approved) for the next stage, never shown as a step
    const isHandoff = kind === "handoff";
    const { error } = await client.from("film_versions").insert({
      project_id: projectId,
      stage: STAGE,
      kind,
      version: (same.at(-1)?.version ?? 0) + 1,
      body: reply.content,
      data: { notes: reply.notes, questions: kind === "questions" ? reply.questions : undefined, cost_usd: claudeCost(usage) },
      status: isHandoff ? "approved" : "awaiting_approval",
      approved_at: isHandoff ? new Date().toISOString() : null,
      created_by: "assistant",
    });
    if (error) throw error;
    // The reply joins the conversation only once its deliverable is stored, so a failure stays retryable
    await client.from("film_messages").insert({ project_id: projectId, stage: STAGE, role: "assistant", content: result.raw });
    if (isHandoff) {
      // the project moves to the sheet maker the first time only: a screenplay revised later never pushes it back
      await client.from("film_projects").update({ stage: "sheets" }).eq("id", projectId).eq("stage", "screenwriter");
      after(() => watchAfterScreenplay(projectId));
    }

    await succeedJob(jobId, { costUsd: claudeCost(usage), units: totalTokens(usage) });
  } catch (err) {
    console.error("screenwriter job failed", err);
    await failJob(jobId, err);
  }
}
