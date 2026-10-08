// «الرجوع الذكي»: the person edits an earlier step directly, and only what the edit really touches is made again.
// When a revised screenplay is approved while sheets or shots already exist, سجاد compares the old screenplay with
// the new one and lists which sheets (characters, places) and which shots (GEN-xx) the change reaches — the rest
// stays as it is. When a sheet's picture changes after the director planned the shots, the shots that use it are
// listed by the code itself (no Claude). The list waits for the person: «حدّث المتأثر» sends each affected item to its
// maker (the sheet maker, the director) as an ordinary edit; «خلّه» leaves everything. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, totalTokens } from "./anthropic";
import { directorAction, directorVersions } from "./director";
import { sheetAction, sheetVersions } from "./sheets";
import { scriptVersions } from "./script";
import { failJob, startJob, succeedJob } from "./usage";
import type { FilmProject } from "./types";

const db = () => createAdminClient();
const STAGE = "impact";
const ESTIMATE_USD = 0.2;

export interface ImpactItem {
  id: string;
  name: string;
  why: string;
}
export interface Impact {
  id: string;
  /** what changed: the screenplay, or one sheet's picture */
  source: "screenplay" | "sheet";
  sourceName: string;
  summary: string;
  sheets: ImpactItem[];
  generations: ImpactItem[];
  /** named items the change does not reach (shown so the person sees what stays) */
  kept: string[];
  status: "awaiting_approval" | "approved" | "superseded";
  applied?: string[];
  created_at: string;
}

const view = (r: Record<string, unknown>): Impact => {
  const d = (r.data ?? {}) as Partial<Impact>;
  return {
    id: String(r.id),
    source: d.source === "sheet" ? "sheet" : "screenplay",
    sourceName: String(d.sourceName ?? ""),
    summary: String(r.body ?? ""),
    sheets: Array.isArray(d.sheets) ? d.sheets : [],
    generations: Array.isArray(d.generations) ? d.generations : [],
    kept: Array.isArray(d.kept) ? d.kept : [],
    status: r.status === "approved" ? "approved" : r.status === "superseded" ? "superseded" : "awaiting_approval",
    applied: Array.isArray(d.applied) ? d.applied : undefined,
    created_at: String(r.created_at ?? ""),
  };
};

/** The impact lists of a project, newest last (the page shows the one still waiting). */
export async function impactsOf(projectId: string): Promise<Impact[]> {
  const { data } = await db().from("film_versions").select("id,body,data,status,created_at").eq("project_id", projectId).eq("stage", STAGE).order("created_at", { ascending: true });
  return ((data ?? []) as Record<string, unknown>[]).map(view);
}

async function store(projectId: string, o: Omit<Impact, "id" | "status" | "created_at">) {
  const { data: all } = await db().from("film_versions").select("id,status").eq("project_id", projectId).eq("stage", STAGE);
  const old = (all ?? []).filter((x) => x.status === "awaiting_approval");
  if (old.length) await db().from("film_versions").update({ status: "superseded" }).in("id", old.map((x) => x.id));
  const { error } = await db().from("film_versions").insert({
    project_id: projectId, stage: STAGE, kind: "impact", ref_key: "", version: (all?.length ?? 0) + 1, body: o.summary,
    data: { source: o.source, sourceName: o.sourceName, sheets: o.sheets, generations: o.generations, kept: o.kept },
    status: o.sheets.length || o.generations.length ? "awaiting_approval" : "approved", created_by: "assistant",
  });
  if (error) throw error;
}

/** What exists after the screenplay: the sheets of the map and the shots of the director's map, by id and name. */
async function laterWork(projectId: string) {
  const [sv, dv] = await Promise.all([sheetVersions(projectId), directorVersions(projectId)]);
  const map = sv.filter((v) => v.kind === "sheet_understanding" && v.status === "approved").at(-1)?.data.sheet_map ?? [];
  const sheets = map.filter((m) => m.id !== "STY-00").map((m) => ({ id: m.id, name: m.name, coverage: m.coverage, prompt: sv.filter((v) => v.kind === "sheet_prompt" && v.ref_key === m.id && v.status === "approved").at(-1)?.data.prompt ?? "" }));
  const gmap = dv.filter((v) => v.kind === "dir_map" && v.status === "approved").at(-1)?.data.generation_map ?? [];
  const generations = gmap.map((g) => {
    const v = dv.filter((x) => x.kind === "dir_generation" && x.ref_key === g.id && x.status === "approved").at(-1);
    return { id: g.id, name: g.name, summary: g.summary ?? "", refs: (v?.data.references ?? []).map((r) => r.name), dialogue: (v?.data.dialogue_ar ?? []).map((d) => `${d.speaker}: ${d.line}`).join(" / ") };
  });
  return { sheets, generations };
}

const SYSTEM = `أنت «سجاد»، مستشار صانع الأفلام. السيناريو المعتمد لفيلم تغيّر بعد أن صُنعت شيتات الشخصيات والأماكن وخُطّطت لقطات الفيديو. مهمتك: قارن النسخة القديمة بالجديدة وحدّد بدقة أي الشيتات وأي اللقطات يمسّها التغيير فعلًا، لا أكثر.
القواعد:
- شيت يتأثر فقط إذا تغيّر شكل الشخصية أو المكان أو تفصيل ثابت يظهر في صورته (عمر، ملابس، ملامح، فترة المكان، تخطيطه). تغيّر الحوار أو الأحداث وحده لا يغيّر الشيت.
- لقطة تتأثر إذا تغيّر ما يحدث فيها، أو حوارها، أو من يظهر فيها، أو مكانها، أو زمنها، أو حُذفت، أو صار قبلها/بعدها شيء يناقضها.
- ما لم يُمَسّ يُترك ولا يُذكر في المتأثر.
- summary: جملتان بالعربية الواضحة تشرحان ما تغيّر في السيناريو.
- why: جملة قصيرة لكل عنصر متأثر تقول ما الذي تغيّر فيه.
أجب بالمخطط المطلوب فقط.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    sheets: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, why: { type: "string" } }, required: ["id", "why"] } },
    generations: { type: "array", items: { type: "object", additionalProperties: false, properties: { id: { type: "string" }, why: { type: "string" } }, required: ["id", "why"] } },
  },
  required: ["summary", "sheets", "generations"],
};

/**
 * A revised screenplay was approved while later work exists: سجاد compares it with the one before and lists what the
 * change reaches. Charged like his other replies. Nothing is changed here; the list waits for the person.
 */
export async function screenplayImpact(project: FilmProject, user: { id: string; email?: string | null }) {
  const versions = await scriptVersions(project.id);
  const plays = versions.filter((v) => v.kind === "screenplay" && (v.status === "approved" || v.status === "superseded")).sort((a, b) => a.version - b.version);
  const fresh = plays.filter((v) => v.status === "approved").at(-1);
  const old = plays.filter((v) => v.status === "superseded" && fresh && v.version < fresh.version).at(-1);
  if (!fresh || !old) return null;
  const { sheets, generations } = await laterWork(project.id);
  if (!sheets.length && !generations.length) return null;
  const { job, created } = await startJob({ projectId: project.id, user, service: "anthropic", operation: "impact", idempotencyKey: `impact:${fresh.id}`, estimateUsd: ESTIMATE_USD, units: 0, unit: "tokens" });
  if (!created) return null;
  try {
    const ask = [
      "=== السيناريو القديم ===", old.body,
      "=== السيناريو الجديد ===", fresh.body,
      "=== الشيتات الموجودة ===", sheets.length ? sheets.map((s) => `- ${s.id} «${s.name}»: ${s.coverage}`).join("\n") : "(لا شيتات)",
      "=== اللقطات المخطّطة ===", generations.length ? generations.map((g) => `- ${g.id} «${g.name}»: ${g.summary}${g.refs.length ? ` · المراجع: ${g.refs.join("، ")}` : ""}${g.dialogue ? ` · الحوار: ${g.dialogue.slice(0, 300)}` : ""}`).join("\n") : "(لا لقطات)",
    ].join("\n\n");
    const r = await callClaudeJson<{ summary: string; sheets: { id: string; why: string }[]; generations: { id: string; why: string }[] }>({ system: SYSTEM, turns: [{ role: "user", content: ask }], schema: SCHEMA, maxTokens: 4000, effort: "medium" });
    const hitS = r.data.sheets.flatMap((x) => { const s = sheets.find((y) => y.id === x.id.trim()); return s ? [{ id: s.id, name: s.name, why: x.why.trim() }] : []; });
    const hitG = r.data.generations.flatMap((x) => { const g = generations.find((y) => y.id === x.id.trim()); return g ? [{ id: g.id, name: g.name, why: x.why.trim() }] : []; });
    const kept = [...sheets.filter((s) => !hitS.some((h) => h.id === s.id)).map((s) => s.name), ...generations.filter((g) => !hitG.some((h) => h.id === g.id)).map((g) => `${g.id} ${g.name}`)];
    await store(project.id, { source: "screenplay", sourceName: "السيناريو", summary: r.data.summary.trim(), sheets: hitS, generations: hitG, kept });
    await succeedJob(job.id, { costUsd: claudeCost(r.usage), units: totalTokens(r.usage) });
    return true;
  } catch (e) {
    await failJob(job.id, e);
    console.error("screenplay impact", e);
    return null;
  }
}

/**
 * A sheet's approved picture changed after the director planned the shots: the shots that carry it as a reference are
 * the affected ones (decided by the code, nothing charged).
 */
export async function sheetImpact(project: FilmProject, sheetId: string, atName: string) {
  const { sheets, generations } = await laterWork(project.id);
  if (!generations.length) return;
  const sheet = sheets.find((s) => s.id === sheetId);
  const hit = generations.filter((g) => g.refs.includes(atName)).map((g) => ({ id: g.id, name: g.name, why: `يستخدم ${atName} مرجعًا` }));
  if (!hit.length) return;
  const kept = generations.filter((g) => !hit.some((h) => h.id === g.id)).map((g) => `${g.id} ${g.name}`);
  await store(project.id, { source: "sheet", sourceName: sheet?.name ?? sheetId, summary: `صورة «${sheet?.name ?? sheetId}» تغيّرت، وهذه اللقطات ترسم بها.`, sheets: [], generations: hit, kept });
}

/** «حدّث المتأثر»: the chosen items go to their makers as ordinary edits; the list is marked applied. */
export async function applyImpact(project: FilmProject, user: { id: string; email?: string | null }, impactId: unknown, pick: { sheets?: unknown; generations?: unknown }) {
  const all = await impactsOf(project.id);
  const im = all.find((x) => x.id === String(impactId));
  if (!im || im.status !== "awaiting_approval") throw new UserError("هذي القائمة ما عادت تنتظر.", 409);
  const want = (v: unknown, from: ImpactItem[]) => (Array.isArray(v) ? from.filter((x) => v.includes(x.id)) : from);
  const sheets = want(pick.sheets, im.sheets);
  const gens = want(pick.generations, im.generations);
  const applied: string[] = [];
  const jobs: string[] = [];
  if (sheets.length) {
    const text = [`السيناريو تغيّر: ${im.summary}`, "أعد كتابة الشيتات التالية فقط بما يناسب التغيير (الباقي يبقى كما هو):", ...sheets.map((s) => `- ${s.id} «${s.name}»: ${s.why}`)].join("\n");
    const r = await sheetAction(project, user, { action: "revise", text, mode: "edit" });
    if (r.jobId) jobs.push(r.jobId);
    applied.push(...sheets.map((s) => `🎨 ${s.name}`));
  }
  if (gens.length && project.stage !== "screenwriter" && project.stage !== "sheets") {
    const text = [`${im.source === "sheet" ? `صورة «${im.sourceName}» تغيّرت` : `السيناريو تغيّر: ${im.summary}`}`, "أعد كتابة اللقطات التالية فقط، كل واحدة بتحليلها وبرومبتها (الباقي معتمد ويبقى):", ...gens.map((g) => `- ${g.id} «${g.name}»: ${g.why}`)].join("\n");
    const r = await directorAction(project, user, { action: "revise", text, mode: "edit" });
    if (r.jobId) jobs.push(r.jobId);
    applied.push(...gens.map((g) => `🎥 ${g.id}`));
  }
  // the affected shots are flagged until their new version is approved
  if (gens.length) {
    const dv = await directorVersions(project.id);
    const ids = dv.filter((v) => v.kind === "dir_generation" && v.status === "approved" && gens.some((g) => g.id === v.ref_key)).map((v) => v.id);
    if (ids.length) await db().from("film_versions").update({ stale: true }).in("id", ids);
  }
  await db().from("film_versions").update({ status: "approved", data: { source: im.source, sourceName: im.sourceName, sheets: im.sheets, generations: im.generations, kept: im.kept, applied } }).eq("id", im.id);
  return { applied, jobs };
}

/** «خلّه»: the list is closed, nothing is remade. */
export async function dropImpact(project: FilmProject, impactId: unknown) {
  const im = (await impactsOf(project.id)).find((x) => x.id === String(impactId));
  if (!im) throw new UserError("ما لقينا القائمة.", 404);
  const { error } = await db().from("film_versions").update({ status: "approved", data: { source: im.source, sourceName: im.sourceName, sheets: im.sheets, generations: im.generations, kept: im.kept, applied: ["ما طُبّق"] } }).eq("id", im.id);
  if (error) throw error;
}
