import { after } from "next/server";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, totalTokens, type ClaudePart, type ClaudeTurn } from "./anthropic";
import { generateFilmImage, IMAGE_ESTIMATE_USD, IMAGE_SIZES } from "./images";
import { failJob, JOB_STALE_MS, startJob, succeedJob } from "./usage";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmJob, type FilmProject } from "./types";
import { GENERATOR_FACTS, SHEET_APP_INTEGRATION, SHEET_MAKER_PROMPT, SHEET_MAKER_SCHEMA, STYLE_PLACEHOLDER } from "@config/film-prompts/sheet-maker";
import { findStyle } from "@config/film-styles";

const STAGE = "sheets";
const SYSTEM = `${SHEET_MAKER_PROMPT}\n\n${SHEET_APP_INTEGRATION}`;
const ESTIMATE_USD = 0.8;
const MAX_TOKENS = 32000;
export const MASTER_ID = "STY-00";
export const STYLE_TEST_ID = "STYLE-TEST";

// Prefixed so version numbers never collide with the screenwriter's deliverables of the same name
export type SheetKind = "sheet_understanding" | "sheet_questions" | "style_test" | "style" | "sheet_prompt" | "sheet_handoff";
export type MapChoice = "make" | "as_is" | "reference";

export interface MapItem {
  id: string;
  kind: "master" | "character" | "environment";
  name: string;
  coverage: string;
}

interface Reply {
  stage: number;
  content: string;
  notes: string;
  questions: { question: string; options: string[] }[];
  sheet_map: MapItem[];
  prompt: string;
  sheet_id: string;
  references: { sheet_id: string; role: string }[];
}

export interface SheetVersion {
  id: string;
  kind: SheetKind;
  ref_key: string;
  version: number;
  body: string;
  data: {
    notes?: string;
    questions?: Reply["questions"];
    answers?: string[];
    sheet_map?: MapItem[];
    choices?: Record<string, MapChoice>;
    prompt?: string;
    references?: Reply["references"];
    styleId?: string;
  };
  status: "draft" | "awaiting_approval" | "approved" | "superseded";
  stale: boolean;
  created_at: string;
}

const db = () => createAdminClient();
const IMAGE_MARK = /\[\[image:([0-9a-f-]{36})\]\]/g;

/** "@الأخ_الكبير" from a sheet's Arabic name. */
export const atName = (name: string) => "@" + name.trim().replace(/[\s@]+/g, "_").replace(/[^\p{L}\p{N}_-]/gu, "").slice(0, 40);

export async function sheetVersions(projectId: string) {
  const { data } = await db()
    .from("film_versions")
    .select("id,kind,ref_key,version,body,data,status,stale,created_at")
    .eq("project_id", projectId)
    .eq("stage", STAGE)
    .order("created_at", { ascending: true });
  return (data ?? []) as SheetVersion[];
}

export async function sheetAssets(projectId: string) {
  const { data } = await db()
    .from("film_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("kind", ["image", "upload"])
    .neq("ref_key", "")
    .order("created_at", { ascending: true });
  return (data ?? []) as FilmAsset[];
}

const latest = (vs: SheetVersion[], kind: SheetKind, ref = "") => vs.filter((v) => v.kind === kind && v.ref_key === ref).at(-1);
const approvedMap = (vs: SheetVersion[]) => {
  const u = vs.filter((v) => v.kind === "sheet_understanding" && v.status === "approved").at(-1);
  return { map: u?.data.sheet_map ?? [], choices: u?.data.choices ?? {} };
};

/** The approved picture standing behind each sheet ID (a generated sheet or an upload kept as is). */
export function approvedImages(assets: FilmAsset[]) {
  const out: Record<string, FilmAsset> = {};
  for (const a of assets) if (a.status === "approved" && a.ref_key !== STYLE_TEST_ID) out[a.ref_key] = a;
  return out;
}

/** Latest job of a kind for this project; a job stuck "running" past the limit is failed and released. */
export async function latestJob(projectId: string, operation: string, assetId?: string): Promise<FilmJob | null> {
  let q = db().from("film_jobs").select("*").eq("project_id", projectId).eq("operation", operation);
  if (assetId) q = q.eq("asset_id", assetId);
  const { data } = await q.order("created_at", { ascending: false }).limit(1).maybeSingle();
  const job = (data as FilmJob) ?? null;
  if (job?.status === "running" && Date.now() - new Date(job.started_at ?? job.created_at).getTime() > JOB_STALE_MS) {
    await failJob(job.id, "انتهى وقت الطلب قبل ما يكمل");
    return { ...job, status: "failed", error: "انتهى وقت الطلب قبل ما يكمل" };
  }
  return job;
}

/** Image jobs still running (style tests and sheets), reaped if stale. */
export async function runningImageJobs(projectId: string) {
  const { data } = await db().from("film_jobs").select("*").eq("project_id", projectId).eq("operation", "sheet_image").eq("status", "running");
  const live: FilmJob[] = [];
  for (const j of (data ?? []) as FilmJob[]) {
    if (Date.now() - new Date(j.started_at ?? j.created_at).getTime() > JOB_STALE_MS) {
      await failJob(j.id, "انتهى وقت التوليد قبل ما يكمل");
      if (j.asset_id) await db().from("film_assets").update({ status: "failed", error: "انتهى وقت التوليد" }).eq("id", j.asset_id);
    } else live.push(j);
  }
  return live;
}

async function addUserMessage(projectId: string, content: string) {
  const { data, error } = await db().from("film_messages").insert({ project_id: projectId, stage: STAGE, role: "user", content }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

/** Queues the sheet maker's next reply in the background. */
async function queueReply(project: FilmProject, user: { id: string; email?: string | null }, messageId: string) {
  const { count } = await db().from("film_jobs").select("id", { count: "exact", head: true }).like("idempotency_key", `${messageId}%`);
  const { job, created } = await startJob({
    projectId: project.id,
    user,
    service: "anthropic",
    operation: STAGE,
    idempotencyKey: count ? `${messageId}:retry${count}` : messageId,
    estimateUsd: ESTIMATE_USD,
    units: 0,
    unit: "tokens",
  });
  if (created) after(() => runSheetReply(project.id, job.id));
  return job.id;
}

export type SheetAction =
  | { action: "start" }
  | { action: "approve"; versionId: string; choices?: Record<string, MapChoice> }
  | { action: "answers"; versionId: string; answers: string[] }
  | { action: "revise"; text: string; versionId?: string }
  | { action: "retry" }
  | { action: "test_styles"; styleIds: string[] }
  | { action: "choose_style"; styleId: string }
  | { action: "generate_image"; sheetId: string }
  | { action: "approve_image"; assetId: string }
  | { action: "reject_image"; assetId: string }
  | { action: "rename"; assetId: string; name: string };

export async function sheetAction(project: FilmProject, user: { id: string; email?: string | null }, input: SheetAction): Promise<{ jobId: string | null }> {
  if (project.stage === "screenwriter") throw new UserError("اعتمد السيناريو أول.", 409);
  const versions = await sheetVersions(project.id);
  const assets = await sheetAssets(project.id);
  const convo = await latestJob(project.id, STAGE);
  const busy = () => {
    if (convo?.status === "running") throw new UserError("صانع الشيت يكتب ردّه الحين، انتظر شوي.", 409);
  };

  switch (input.action) {
    case "start": {
      busy();
      const { count } = await db().from("film_messages").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("stage", STAGE);
      if (count) throw new UserError("صانع الشيت بدأ من قبل.", 409);
      const { data: handoff } = await db()
        .from("film_versions")
        .select("body")
        .eq("project_id", project.id)
        .eq("stage", "screenwriter")
        .eq("kind", "handoff")
        .eq("status", "approved")
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!handoff) throw new UserError("ما لقينا السيناريو المعتمد.", 409);
      const id = await addUserMessage(project.id, `${handoff.body}\n\n---\n${GENERATOR_FACTS}`);
      return { jobId: await queueReply(project, user, id) };
    }

    case "approve": {
      busy();
      const v = versions.find((x) => x.id === input.versionId);
      if (!v || v.status !== "awaiting_approval" || latest(versions, v.kind, v.ref_key)?.id !== v.id) {
        throw new UserError("«اعتمد» يعتمد آخر نسخة معروضة بس. حدّث الصفحة وجرّب.", 409);
      }
      if (v.kind === "sheet_understanding") return { jobId: await approveMap(project, user, v, input.choices ?? {}, assets) };
      if (v.kind !== "sheet_prompt") throw new UserError("هذا العنصر ما يحتاج اعتماد.", 409);
      await setApproved(v, versions);
      // The master needs its picture first; the course moves on only after the master image is accepted
      if (v.ref_key === MASTER_ID) return { jobId: null };
      const id = await addUserMessage(project.id, "اعتمد");
      return { jobId: await queueReply(project, user, id) };
    }

    case "answers": {
      busy();
      const v = versions.find((x) => x.id === input.versionId);
      if (!v || v.kind !== "sheet_questions" || v.status !== "awaiting_approval") throw new UserError("هذي الأسئلة مو آخر نسخة.", 409);
      const qs = v.data.questions ?? [];
      const answers = input.answers.map((a) => String(a ?? "").trim().slice(0, 1500));
      if (answers.length !== qs.length || answers.some((a) => !a)) throw new UserError("جاوب على كل الأسئلة.", 400);
      await db().from("film_versions").update({ status: "approved", data: { ...v.data, answers } }).eq("id", v.id);
      const id = await addUserMessage(project.id, ["إجاباتي:", ...answers.map((a, i) => `${i + 1}. ${a}`)].join("\n"));
      return { jobId: await queueReply(project, user, id) };
    }

    case "revise": {
      busy();
      const text = String(input.text ?? "").trim();
      if (!text || text.length > 4000) throw new UserError("اكتب التعديل (٤٠٠٠ حرف كحد أقصى).", 400);
      const target = input.versionId ? versions.find((x) => x.id === input.versionId) : undefined;
      const prefix = target?.kind === "sheet_prompt" ? `تعديل على ${target.ref_key}:\n` : "";
      const id = await addUserMessage(project.id, prefix + text);
      return { jobId: await queueReply(project, user, id) };
    }

    case "retry": {
      if (convo?.status !== "failed") throw new UserError("ما فيه شي يحتاج إعادة.", 409);
      const { data: last } = await db()
        .from("film_messages")
        .select("id,role")
        .eq("project_id", project.id)
        .eq("stage", STAGE)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!last || last.role !== "user") throw new UserError("ما فيه شي يحتاج إعادة.", 409);
      return { jobId: await queueReply(project, user, last.id) };
    }

    case "test_styles": {
      const test = latest(versions, "style_test");
      if (!test?.data.prompt) throw new UserError("برومبت لقطة الاختبار ما جهز للحين.", 409);
      const ids = [...new Set(input.styleIds)].filter((s) => findStyle(s)).slice(0, 4);
      if (!ids.length) throw new UserError("اختر ستايل واحد على الأقل (٤ كحد أقصى).", 400);
      for (const styleId of ids) {
        const prompt = test.data.prompt.replace(STYLE_PLACEHOLDER, findStyle(styleId)!.text);
        await startImage(project, user, { sheetId: STYLE_TEST_ID, prompt, refs: [], kind: "test", versionId: test.id, meta: { styleId } });
      }
      return { jobId: null };
    }

    case "choose_style": {
      busy();
      const style = findStyle(input.styleId);
      if (!style) throw new UserError("ستايل غير معروف.", 400);
      if (latest(versions, "style")?.status === "approved") throw new UserError("الستايل انقفل من قبل.", 409);
      if (!latest(versions, "style_test")) throw new UserError("لقطة الاختبار ما جهزت.", 409);
      await db().from("film_versions").insert({
        project_id: project.id, stage: STAGE, kind: "style", version: 1, body: style.text,
        data: { styleId: style.id }, status: "approved", approved_at: new Date().toISOString(), created_by: "user",
      });
      // The course: the user sends the selected style text, stored and used verbatim
      const id = await addUserMessage(project.id, `الستايل المعتمد:\n${style.text}`);
      return { jobId: await queueReply(project, user, id) };
    }

    case "generate_image": {
      const prompt = versions.filter((v) => v.kind === "sheet_prompt" && v.ref_key === input.sheetId && v.status === "approved").at(-1);
      if (!prompt?.data.prompt) throw new UserError("اعتمد برومبت هذا الشيت أول.", 409);
      const images = approvedImages(assets);
      if (input.sheetId !== MASTER_ID && !images[MASTER_ID]) throw new UserError("اعتمد صورة الماستر أول؛ هي مرجع الستايل لكل الشيتات.", 409);
      const refIds = new Set((prompt.data.references ?? []).map((r) => r.sheet_id));
      if (input.sheetId !== MASTER_ID) refIds.add(MASTER_ID);
      refIds.delete(input.sheetId);
      const refs = [...refIds].map((id) => images[id]).filter(Boolean);
      // The user's own picture given "as a reference" for this sheet
      const own = assets.filter((a) => a.kind === "upload" && a.ref_key === input.sheetId && a.meta?.mode === "reference").at(-1);
      if (own) refs.push(own);
      await startImage(project, user, { sheetId: input.sheetId, prompt: prompt.data.prompt, refs, kind: "sheet", versionId: prompt.id, meta: {} });
      return { jobId: null };
    }

    case "approve_image": {
      busy();
      const a = assets.find((x) => x.id === input.assetId);
      if (!a || a.kind !== "image" || a.status !== "generated" || a.ref_key === STYLE_TEST_ID) throw new UserError("هذي الصورة ما تنعتمد.", 409);
      const { map } = approvedMap(versions);
      const item = map.find((m) => m.id === a.ref_key);
      const older = assets.filter((x) => x.ref_key === a.ref_key && x.id !== a.id && x.status === "approved").map((x) => x.id);
      if (older.length) await db().from("film_assets").update({ status: "rejected" }).in("id", older);
      await db().from("film_assets").update({ status: "approved", meta: { ...a.meta, at_name: atName(item?.name ?? a.ref_key) } }).eq("id", a.id);
      if (a.ref_key === MASTER_ID) {
        const id = await addUserMessage(project.id, `اعتمد\nصورة الماستر ${MASTER_ID} المولّدة مرفقة هنا:\n[[image:${a.id}]]`);
        return { jobId: await queueReply(project, user, id) };
      }
      return { jobId: await maybeFinish(project, user) };
    }

    case "reject_image": {
      const a = assets.find((x) => x.id === input.assetId);
      if (!a || a.kind !== "image") throw new UserError("ما لقينا الصورة.", 404);
      await db().from("film_assets").update({ status: "rejected" }).eq("id", a.id);
      return { jobId: null };
    }

    case "rename": {
      const a = assets.find((x) => x.id === input.assetId);
      if (!a || a.status !== "approved") throw new UserError("الاسم يتغيّر للمراجع المعتمدة بس.", 409);
      const name = atName(String(input.name ?? "").replace(/^@/, ""));
      if (name.length < 2) throw new UserError("اكتب اسم صحيح.", 400);
      const clash = assets.some((x) => x.id !== a.id && x.status === "approved" && x.meta?.at_name === name);
      if (clash) throw new UserError("هذا الاسم مستخدم لمرجع ثاني.", 409);
      await db().from("film_assets").update({ meta: { ...a.meta, at_name: name } }).eq("id", a.id);
      return { jobId: null };
    }
  }
}

async function setApproved(v: SheetVersion, versions: SheetVersion[]) {
  const older = versions.filter((x) => x.kind === v.kind && x.ref_key === v.ref_key && x.id !== v.id && x.status === "approved").map((x) => x.id);
  if (older.length) await db().from("film_versions").update({ status: "superseded" }).in("id", older);
  await db().from("film_versions").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", v.id);
}

/** Approving the map, with the user's choice per item: generate it, or use their own picture (as is / as a reference). */
async function approveMap(project: FilmProject, user: { id: string; email?: string | null }, v: SheetVersion, choices: Record<string, MapChoice>, assets: FilmAsset[]) {
  const map = v.data.sheet_map ?? [];
  const clean: Record<string, MapChoice> = {};
  const lines: string[] = [];
  for (const item of map) {
    const choice: MapChoice = item.id === MASTER_ID ? "make" : (choices[item.id] ?? "make");
    clean[item.id] = choice;
    if (choice === "make") continue;
    const up = assets.filter((a) => a.kind === "upload" && a.ref_key === item.id).at(-1);
    if (!up) throw new UserError(`ارفع صورة «${item.name}» أول، أو اختر «اصنعه لي».`, 400);
    await db().from("film_assets").update({
      status: choice === "as_is" ? "approved" : "uploaded",
      meta: { ...up.meta, mode: choice, ...(choice === "as_is" ? { at_name: atName(item.name) } : {}) },
    }).eq("id", up.id);
    lines.push(
      choice === "as_is"
        ? `- ${item.id} (${item.name}): عندي صورته الجاهزة، معتمدة كما هي ولا تحتاج برومبت: [[image:${up.id}]]`
        : `- ${item.id} (${item.name}): هذي صورة مرجعية من عندي، اصنع الشيت منها بستايل المشروع: [[image:${up.id}]]`,
    );
  }
  await db().from("film_versions").update({ status: "approved", approved_at: new Date().toISOString(), data: { ...v.data, choices: clean } }).eq("id", v.id);
  const text = lines.length ? `اعتمد\n\nمعلومات عن الصور:\n${lines.join("\n")}` : "اعتمد";
  const id = await addUserMessage(project.id, text);
  return queueReply(project, user, id);
}

/**
 * When every sheet has its approved picture, the handoff is (re)built in the background with the real
 * statuses, and the project moves on to the director.
 */
async function maybeFinish(project: FilmProject, user: { id: string; email?: string | null }) {
  const versions = await sheetVersions(project.id);
  const assets = await sheetAssets(project.id);
  const { map } = approvedMap(versions);
  const images = approvedImages(assets);
  if (!map.length || !map.every((m) => images[m.id])) return null;
  const list = map.map((m) => `- ${m.id} (${m.name}) ${images[m.id].meta?.at_name ?? ""}: [[image:${images[m.id].id}]]`).join("\n");
  const id = await addUserMessage(project.id, `كل صور الشيتات صارت معتمدة ومرفقة هنا:\n${list}\n\nجهّز رسالة التسليم النهائية بحالاتها الصحيحة.`);
  return queueReply(project, user, id);
}

/** Creates the asset + paid job for one picture and generates it in the background. */
async function startImage(
  project: FilmProject,
  user: { id: string; email?: string | null },
  o: { sheetId: string; prompt: string; refs: FilmAsset[]; kind: "test" | "sheet"; versionId: string; meta: Record<string, unknown> },
) {
  const running = await runningImageJobs(project.id);
  if (running.length >= 4) throw new UserError("فيه صور تتولد الحين، انتظرها تخلص.", 409);
  const { data: asset, error } = await db()
    .from("film_assets")
    .insert({ project_id: project.id, kind: "image", ref_key: o.sheetId, version_id: o.versionId, status: "generating", meta: o.meta })
    .select()
    .single();
  if (error) throw error;
  const { job } = await startJob({
    projectId: project.id,
    user,
    service: "openai_image",
    operation: "sheet_image",
    idempotencyKey: `image:${asset.id}`,
    estimateUsd: IMAGE_ESTIMATE_USD[o.kind],
    units: 1,
    unit: "images",
    assetId: asset.id,
  }).catch(async (e) => {
    await db().from("film_assets").delete().eq("id", asset.id);
    throw e;
  });
  after(() => runImage(project, job.id, asset.id, o));
}

async function runImage(project: FilmProject, jobId: string, assetId: string, o: { prompt: string; refs: FilmAsset[]; kind: "test" | "sheet" }) {
  const client = db();
  try {
    const refs: Buffer[] = [];
    for (const r of o.refs) {
      const f = await client.storage.from(FILM_BUCKET).download(r.storage_path!);
      if (f.error) throw f.error;
      refs.push(Buffer.from(await f.data.arrayBuffer()));
    }
    const { png, costUsd, tokens } = await generateFilmImage({
      prompt: o.prompt,
      references: refs,
      size: o.kind === "test" ? IMAGE_SIZES.test : IMAGE_SIZES.sheet,
      quality: o.kind === "test" ? "medium" : "high",
    });
    const path = `${projectDir(project)}/sheets/${assetId}.png`;
    const up = await client.storage.from(FILM_BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
    if (up.error) throw up.error;
    await client.from("film_assets").update({ status: "generated", storage_path: path, mime: "image/png", bytes: png.length, error: null }).eq("id", assetId);
    await succeedJob(jobId, { costUsd: costUsd ?? IMAGE_ESTIMATE_USD[o.kind], units: tokens });
  } catch (err) {
    console.error("film image failed", err);
    const msg = String(err instanceof Error ? err.message : err).slice(0, 300);
    await client.from("film_assets").update({ status: "failed", error: msg }).eq("id", assetId);
    await failJob(jobId, err);
  }
}

/** Builds Claude turns; [[image:id]] markers become real images (short-lived links). */
async function buildTurns(projectId: string): Promise<ClaudeTurn[]> {
  const client = db();
  const { data } = await client
    .from("film_messages")
    .select("role,content")
    .eq("project_id", projectId)
    .eq("stage", STAGE)
    .order("created_at", { ascending: true });
  const msgs = (data ?? []) as { role: "user" | "assistant"; content: string }[];
  const ids = [...new Set(msgs.flatMap((m) => [...m.content.matchAll(IMAGE_MARK)].map((x) => x[1])))];
  const urls: Record<string, string> = {};
  if (ids.length) {
    const { data: rows } = await client.from("film_assets").select("id,storage_path").in("id", ids);
    for (const r of rows ?? []) {
      if (!r.storage_path) continue;
      const s = await client.storage.from(FILM_BUCKET).createSignedUrl(r.storage_path, 3600);
      if (s.data) urls[r.id] = s.data.signedUrl;
    }
  }
  const toParts = (text: string): ClaudePart[] => {
    const parts: ClaudePart[] = [];
    let last = 0;
    for (const m of text.matchAll(IMAGE_MARK)) {
      if (m.index! > last) parts.push({ type: "text", text: text.slice(last, m.index) });
      if (urls[m[1]]) parts.push({ type: "image", url: urls[m[1]] });
      else parts.push({ type: "text", text: "(الصورة غير متاحة)" });
      last = m.index! + m[0].length;
    }
    if (last < text.length) parts.push({ type: "text", text: text.slice(last) });
    return parts.length ? parts : [{ type: "text", text }];
  };
  const turns: ClaudeTurn[] = [];
  for (const m of msgs) {
    const parts = m.role === "user" ? toParts(m.content) : [{ type: "text" as const, text: m.content }];
    const prev = turns.at(-1);
    if (prev && prev.role === m.role) (prev.content as ClaudePart[]).push({ type: "text", text: "\n\n" }, ...parts);
    else turns.push({ role: m.role, content: parts });
  }
  return turns;
}

const KIND_BY_STAGE: Record<number, SheetKind> = { 2: "sheet_understanding", 3: "sheet_questions", 4: "style_test", 5: "sheet_prompt", 6: "sheet_prompt", 7: "sheet_handoff" };

export async function runSheetReply(projectId: string, jobId: string) {
  try {
    const turns = await buildTurns(projectId);
    if (turns.at(-1)?.role !== "user") throw new Error("nothing to answer");
    const result = await callClaudeJson<Reply>({ system: SYSTEM, turns, schema: SHEET_MAKER_SCHEMA, maxTokens: MAX_TOKENS });
    const r = result.data;
    const kind = KIND_BY_STAGE[r.stage];
    if (!kind) throw new Error(`unexpected stage ${r.stage}`);
    const ref = kind === "sheet_prompt" ? (r.stage === 5 ? MASTER_ID : r.sheet_id || "?") : "";

    const client = db();
    const versions = await sheetVersions(projectId);
    const same = versions.filter((v) => v.kind === kind && v.ref_key === ref);
    const isHandoff = kind === "sheet_handoff";
    const old = same.filter((v) => v.status === "awaiting_approval" || v.status === "draft" || (isHandoff && v.status === "approved")).map((v) => v.id);
    if (old.length) await client.from("film_versions").update({ status: "superseded" }).in("id", old);
    const { error } = await client.from("film_versions").insert({
      project_id: projectId,
      stage: STAGE,
      kind,
      ref_key: ref,
      version: (same.at(-1)?.version ?? 0) + 1,
      body: r.content,
      data: {
        notes: r.notes,
        questions: kind === "sheet_questions" ? r.questions : undefined,
        sheet_map: kind === "sheet_understanding" ? r.sheet_map : undefined,
        prompt: r.prompt || undefined,
        references: r.references?.length ? r.references : undefined,
      },
      // The handoff is passed on in the background and never shown as a step
      status: isHandoff || kind === "style_test" ? "approved" : "awaiting_approval",
      approved_at: isHandoff || kind === "style_test" ? new Date().toISOString() : null,
      created_by: "assistant",
    });
    if (error) throw error;
    // The reply joins the conversation only once its deliverable is stored, so a failure stays retryable
    await client.from("film_messages").insert({ project_id: projectId, stage: STAGE, role: "assistant", content: result.raw });
    await succeedJob(jobId, { costUsd: claudeCost(result.usage), units: totalTokens(result.usage) });

    if (isHandoff) {
      const all = await sheetVersions(projectId);
      const { map } = approvedMap(all);
      const images = approvedImages(await sheetAssets(projectId));
      if (map.length && map.every((m) => images[m.id])) await client.from("film_projects").update({ stage: "director" }).eq("id", projectId);
    }
  } catch (err) {
    console.error("sheet maker reply failed", err);
    await failJob(jobId, err);
  }
}

/** Upload of the user's own picture for one map item (step 1: one-time signed URL). */
export async function sheetUploadUrl(project: FilmProject, sheetId: string, mime: string) {
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[mime];
  if (!ext || !/^[A-Z]{3}-\d{2}$/.test(sheetId)) throw new UserError("صورة JPG أو PNG أو WEBP فقط.", 400);
  const path = `${projectDir(project)}/sheets/upload-${sheetId}-${Date.now()}.${ext}`;
  const { data, error } = await db().storage.from(FILM_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

/** Step 2: records the uploaded picture against its map item. */
export async function confirmSheetUpload(project: FilmProject, sheetId: string, path: string) {
  const dir = `${projectDir(project)}/sheets`;
  if (!path.startsWith(`${dir}/upload-${sheetId}-`) || path.includes("..")) throw new UserError("ملف غير صحيح.", 400);
  const name = path.slice(dir.length + 1);
  const { data: list } = await db().storage.from(FILM_BUCKET).list(dir, { search: name });
  const file = list?.find((f) => f.name === name);
  const size = Number(file?.metadata?.size ?? 0);
  if (!file || size <= 0 || size > 20 * 1024 * 1024) throw new UserError("ما وصل الملف أو حجمه أكبر من ٢٠ ميجا.", 400);
  // Only the latest upload counts for this item
  await db().from("film_assets").update({ status: "rejected" }).eq("project_id", project.id).eq("kind", "upload").eq("ref_key", sheetId);
  const { error } = await db().from("film_assets").insert({
    project_id: project.id, kind: "upload", ref_key: sheetId, storage_path: path, file_name: name,
    mime: String(file.metadata?.mimetype ?? ""), bytes: size, status: "uploaded", meta: {},
  });
  if (error) throw error;
}
