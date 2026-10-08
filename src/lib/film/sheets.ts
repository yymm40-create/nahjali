import { after } from "next/server";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, totalTokens } from "./anthropic";
import { addMessage, buildTurns } from "./conversation";
import { generateFilmImage, IMAGE_ESTIMATE_USD, IMAGE_SIZES } from "./images";
import { failJob, JOB_STALE_MS, startJob, succeedJob } from "./usage";
import { FILM_BUCKET, projectDir, type FilmAsset, type FilmJob, type FilmProject } from "./types";
import { GENERATOR_FACTS, MASTER_STYLE_ONLY, SHEET_APP_INTEGRATION, SHEET_MAKER_PROMPT, SHEET_MAKER_SCHEMA, STYLE_PLACEHOLDER } from "@config/film-prompts/sheet-maker";
import { findStyle } from "@config/film-styles";

import { storage } from "@/lib/storage";
const STAGE = "sheets";
const SYSTEM = `${SHEET_MAKER_PROMPT}\n\n${SHEET_APP_INTEGRATION}`;
const ESTIMATE_USD = 0.8;
const MAX_TOKENS = 32000;
export const MASTER_ID = "STY-00";
export const STYLE_TEST_ID = "STYLE-TEST";
export const MAX_REFERENCE_UPLOADS = 4;
// Pictures generated at the same time (all the sheets together, plus a few style tests)
const MAX_IMAGES_AT_ONCE = 24;

// Prefixed so version numbers never collide with the screenwriter's deliverables of the same name
export type SheetKind = "sheet_understanding" | "sheet_questions" | "style_test" | "style" | "sheet_prompt" | "sheet_handoff";
// make: generated · as_is: the user's picture is final · reference: one picture to design the sheet from
// convert: 1–4 photos of a real person turned into a cartoon character sheet in the project's style
export type MapChoice = "make" | "as_is" | "reference" | "convert";
const multiUpload = (c: MapChoice) => c === "convert";

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
  suggestion: string;
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
    suggestion?: string;
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

/** Map items (after the master) that still need a prompt: not supplied "as is" and none delivered yet. */
export function pendingSheets(vs: SheetVersion[]) {
  const { map, choices } = approvedMap(vs);
  return map.filter((m) => m.id !== MASTER_ID && choices[m.id] !== "as_is" && !vs.some((v) => v.kind === "sheet_prompt" && v.ref_key === m.id));
}

// «كل الشيتات مع بعض»: after the master, every remaining sheet's prompt is written at once (one request per sheet,
// in parallel), instead of one sheet per reply
const BATCH_REQUEST = "اعتمد. اكتب برومبتات كل الشيتات الباقية دفعة واحدة";
const batchMessage = (items: MapItem[], masterImageId?: string) =>
  `${BATCH_REQUEST}: ${items.map((m) => `${m.id} (${m.name})`).join("، ")}` +
  (masterImageId ? `\nصورة الماستر ${MASTER_ID} المولّدة مرفقة هنا:\n[[image:${masterImageId}]]` : "");

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

const addUserMessage = (projectId: string, content: string) => addMessage(projectId, STAGE, content);

/** Queues the sheet maker's next reply in the background. */
async function queueReply(project: FilmProject, user: { id: string; email?: string | null }, messageId: string, estimateUsd = ESTIMATE_USD) {
  const { count } = await db().from("film_jobs").select("id", { count: "exact", head: true }).like("idempotency_key", `${messageId}%`);
  const { job, created } = await startJob({
    projectId: project.id,
    user,
    service: "anthropic",
    operation: STAGE,
    idempotencyKey: count ? `${messageId}:retry${count}` : messageId,
    estimateUsd,
    units: 0,
    unit: "tokens",
  });
  if (created) after(() => runSheetReply(project.id, job.id));
  return job.id;
}

export type SheetAction =
  | { action: "start" }
  | { action: "approve"; versionId: string; choices?: Record<string, MapChoice>; count?: number }
  | { action: "answers"; versionId: string; answers: string[] }
  | { action: "revise"; text: string; versionId?: string; mode?: "edit" | "direct" }
  | { action: "retry" }
  | { action: "finish" }
  | { action: "test_styles"; styleIds: string[] }
  | { action: "choose_style"; styleId: string }
  | { action: "generate_image"; sheetId: string; count?: number }
  // «تأكد من فهمي»: how the sheet maker understood an edit, before anything is written or drawn
  | { action: "understand_edit"; sheetId: string; text: string }
  | { action: "write_all" }
  | { action: "approve_all_prompts" }
  | { action: "approve_all_images" }
  | { action: "approve_image"; assetId: string }
  | { action: "unapprove_image"; assetId: string }
  | { action: "reject_image"; assetId: string }
  | { action: "rename"; assetId: string; name: string }
  | { action: "remove_upload"; assetId: string };

/** jobId: a reply being written now · images: pictures started by this action (the page follows them) · warning: done, but something to know. */
export type SheetResult = { jobId: string | null; images?: number; warning?: string; understanding?: string };

/** Pictures one press may start for a sheet (attempts side by side). */
export const MAX_ATTEMPTS_AT_ONCE = 5;
const attemptsOf = (n: unknown) => Math.max(1, Math.min(MAX_ATTEMPTS_AT_ONCE, Math.round(Number(n) || 1)));

export async function sheetAction(project: FilmProject, user: { id: string; email?: string | null }, input: SheetAction): Promise<SheetResult> {
  if (project.stage === "screenwriter") throw new UserError("اعتمد السيناريو أول.", 409);
  const versions = await sheetVersions(project.id);
  const assets = await sheetAssets(project.id);
  const convo = await latestJob(project.id, STAGE);
  const busy = () => {
    if (convo?.status === "running") throw new UserError("صانع الشيت يكتب ردّه الحين، انتظر شوي.", 409);
  };
  // A picture that can't start (coins, too many at once) never undoes the approval before it: the page keeps its
  // «ولّد الصورة» button to try again
  const tryImage = async (v: SheetVersion, count = 1) => {
    let images = 0;
    try {
      for (let i = 0; i < count; i++) {
        await generateSheet(project, user, v, assets);
        images++;
      }
      return { images };
    } catch (e) {
      if (e instanceof UserError) return { images, warning: `${images ? `بدأت ${images} صور، والباقي` : "انعتمد، لكن الصورة"} ما بدأت: ${e.message}` };
      throw e;
    }
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
      // Approving a prompt starts its picture right away.
      // The master needs its picture first; the course moves on only after the master image is accepted
      const pic = await tryImage({ ...v, status: "approved" }, attemptsOf(input.count));
      if (v.ref_key === MASTER_ID) return { jobId: null, ...pic };
      // One by one (older projects): "اعتمد" asks for the next sheet. Written all at once: nothing more to ask for
      const others = versions.some((x) => x.kind === "sheet_prompt" && x.ref_key !== MASTER_ID && x.ref_key !== v.ref_key && x.status === "awaiting_approval");
      if (others || !pendingSheets(versions).length) return { jobId: null, ...pic };
      const id = await addUserMessage(project.id, "اعتمد");
      return { jobId: await queueReply(project, user, id), ...pic };
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
      const prefix =
        input.mode === "direct" ? "توجيه / أمر جديد:\n" : target?.kind === "sheet_prompt" ? `تعديل على ${target.ref_key}:\n` : "تعديل:\n";
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

    case "finish": {
      // Every picture is approved but the project never reached the director (e.g. the handoff reply came
      // back as something else): ask the sheet maker for the handoff again. Not counted as an edit.
      busy();
      // Already moved on (e.g. a second press): nothing to do, the page goes to the director
      if (project.stage !== "sheets") return { jobId: null };
      const { map } = approvedMap(versions);
      const images = approvedImages(assets);
      const missing = map.filter((m) => !images[m.id]);
      if (!map.length || missing.length) throw new UserError(`باقي صور ما انعتمدت: ${missing.map((m) => m.name).join("، ")}`, 409);
      return { jobId: await maybeFinish(project, user) };
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
      return { jobId: null, images: ids.length };
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
      // A second press while its picture is still being made would pay for another one
      if (assets.some((a) => a.kind === "image" && a.ref_key === input.sheetId && a.status === "generating")) throw new UserError("صورته تتولد الحين، انتظرها.", 409);
      const r = await tryImage(prompt, attemptsOf(input.count));
      if (!r.images) throw new UserError(r.warning?.replace(/^انعتمد، لكن الصورة ما بدأت: /, "") ?? "ما بدأت الصورة.", 409);
      return { jobId: null, ...r };
    }

    case "understand_edit": {
      const text = String(input.text ?? "").trim();
      if (!text || text.length > 4000) throw new UserError("اكتب التعديل (٤٠٠٠ حرف كحد أقصى).", 400);
      const prompt = latest(versions, "sheet_prompt", input.sheetId);
      const item = approvedMap(versions).map.find((m) => m.id === input.sheetId);
      if (!prompt) throw new UserError("ما لقيت هذا الشيت.", 404);
      return { jobId: null, understanding: await understandEdit(project, user, { id: input.sheetId, name: item?.name ?? input.sheetId, prompt: prompt.data.prompt ?? prompt.body, text }) };
    }

    case "write_all": {
      busy();
      if (!approvedImages(assets)[MASTER_ID]) throw new UserError("اعتمد صورة الماستر أول.", 409);
      const pending = pendingSheets(versions);
      if (!pending.length) throw new UserError("كل الشيتات وصلت برومبتاتها.", 409);
      const id = await addUserMessage(project.id, batchMessage(pending));
      return { jobId: await queueReply(project, user, id, ESTIMATE_USD * pending.length) };
    }

    case "approve_all_prompts": {
      // Every delivered prompt still waiting is approved, and all their pictures are generated together
      busy();
      if (!approvedImages(assets)[MASTER_ID]) throw new UserError("اعتمد صورة الماستر أول.", 409);
      const ids = [...new Set(versions.filter((x) => x.kind === "sheet_prompt" && x.ref_key !== MASTER_ID).map((x) => x.ref_key))];
      const waiting = ids.map((id) => latest(versions, "sheet_prompt", id)!).filter((x) => x.status === "awaiting_approval");
      if (!waiting.length) throw new UserError("ما فيه برومبتات تنتظر الاعتماد.", 409);
      for (const v of waiting) await setApproved(v, versions);
      let images = 0;
      const problems: string[] = [];
      for (const v of waiting) {
        const r = await tryImage({ ...v, status: "approved" });
        images += r.images;
        if (r.warning) problems.push(r.warning);
      }
      const warning = problems.length ? `${waiting.length - images} من الصور ما بدأت: ${problems[0].replace(/^انعتمد، لكن الصورة ما بدأت: /, "")}` : undefined;
      const pending = pendingSheets(versions);
      if (!pending.length) return { jobId: null, images, warning };
      const id = await addUserMessage(project.id, batchMessage(pending));
      return { jobId: await queueReply(project, user, id, ESTIMATE_USD * pending.length), images, warning };
    }

    case "approve_all_images": {
      // The latest new picture of every sheet still without an approved one (the master is approved on its own first)
      const { map } = approvedMap(versions);
      const images = approvedImages(assets);
      const picks = map
        .filter((m) => m.id !== MASTER_ID && !images[m.id])
        .map((m) => assets.filter((a) => a.kind === "image" && a.ref_key === m.id && a.status === "generated").at(-1))
        .filter((a): a is FilmAsset => Boolean(a));
      if (!picks.length) throw new UserError("ما فيه صور جديدة تنتظر الاعتماد.", 409);
      for (const a of picks) {
        const item = map.find((m) => m.id === a.ref_key);
        const { error } = await db().from("film_assets").update({ status: "approved", meta: { ...a.meta, at_name: atName(item?.name ?? a.ref_key) } }).eq("id", a.id).eq("status", "generated");
        if (error) throw error;
      }
      // A reply being written now: the approval is kept, and the page finishes when it's done
      if (convo?.status === "running") return { jobId: convo.id };
      return { jobId: await maybeFinish(project, user) };
    }

    case "approve_image": {
      const a = assets.find((x) => x.id === input.assetId);
      // a rejected attempt can be taken back too (it stays under its sheet for that)
      if (!a || a.kind !== "image" || (a.status !== "generated" && !(a.status === "rejected" && a.storage_path)) || a.ref_key === STYLE_TEST_ID) throw new UserError("هذي الصورة ما تنعتمد.", 409);
      // The master's approval asks for every other sheet's prompt, so it waits for a reply being written now
      if (a.ref_key === MASTER_ID) busy();
      const { map } = approvedMap(versions);
      const item = map.find((m) => m.id === a.ref_key);
      const older = assets.filter((x) => x.ref_key === a.ref_key && x.id !== a.id && x.status === "approved").map((x) => x.id);
      if (older.length) await db().from("film_assets").update({ status: "rejected" }).in("id", older);
      await db().from("film_assets").update({ status: "approved", meta: { ...a.meta, at_name: atName(item?.name ?? a.ref_key) } }).eq("id", a.id);
      const laterSheets = versions.some((x) => x.kind === "sheet_prompt" && x.ref_key !== MASTER_ID);
      if (convo?.status === "running") return { jobId: convo.id };
      if (a.ref_key === MASTER_ID && !laterSheets) {
        // The master is in: every other sheet's prompt is written now, all together
        const pending = pendingSheets(versions);
        const id = await addUserMessage(project.id, pending.length ? batchMessage(pending, a.id) : `اعتمد\nصورة الماستر ${MASTER_ID} المولّدة مرفقة هنا:\n[[image:${a.id}]]`);
        return { jobId: await queueReply(project, user, id, ESTIMATE_USD * Math.max(1, pending.length)) };
      }
      return { jobId: await maybeFinish(project, user) };
    }

    case "unapprove_image": {
      // The user can always take an approval back, then generate another picture or send another edit
      const a = assets.find((x) => x.id === input.assetId);
      if (!a || a.kind !== "image" || a.status !== "approved") throw new UserError("هذي الصورة مو معتمدة.", 409);
      const { error } = await db().from("film_assets").update({ status: "generated" }).eq("id", a.id);
      if (error) throw error;
      // Not every sheet is approved any more: the project is back with the sheet maker
      if (project.stage === "director") await db().from("film_projects").update({ stage: "sheets" }).eq("id", project.id);
      return { jobId: null };
    }

    case "reject_image": {
      const a = assets.find((x) => x.id === input.assetId);
      if (!a || a.kind !== "image") throw new UserError("ما لقينا الصورة.", 404);
      await db().from("film_assets").update({ status: "rejected" }).eq("id", a.id);
      return { jobId: null };
    }

    case "remove_upload": {
      const a = assets.find((x) => x.id === input.assetId);
      if (!a || a.kind !== "upload" || a.status !== "uploaded") throw new UserError("ما لقينا الصورة.", 404);
      const { error } = await db().from("film_assets").update({ status: "rejected" }).eq("id", a.id);
      if (error) throw error;
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
    // the master is made — unless a series' scene takes its series' style picture as it is
    const choice: MapChoice = item.id === MASTER_ID ? (choices[item.id] === "as_is" && project.series_id ? "as_is" : "make") : (choices[item.id] ?? "make");
    clean[item.id] = choice;
    if (choice === "make") continue;
    const active = assets.filter((a) => a.kind === "upload" && a.ref_key === item.id && a.status !== "rejected");
    // One picture (the latest) for "as is" and "reference"; up to 4 photos of the same person for "convert"
    const ups = multiUpload(choice) ? active.slice(-MAX_REFERENCE_UPLOADS) : active.slice(-1);
    if (!ups.length) throw new UserError(`ارفع صورة «${item.name}» أول، أو اختر «اصنعه لي».`, 400);
    const extra = active.filter((a) => !ups.includes(a)).map((a) => a.id);
    if (extra.length) {
      const { error: exErr } = await db().from("film_assets").update({ status: "rejected" }).in("id", extra);
      if (exErr) throw exErr;
    }
    for (const up of ups) {
      const { error: upErr } = await db().from("film_assets").update({
        status: choice === "as_is" ? "approved" : "uploaded",
        meta: { ...up.meta, mode: choice, ...(choice === "as_is" ? { at_name: atName(item.name) } : {}) },
      }).eq("id", up.id);
      if (upErr) throw upErr;
    }
    const marks = ups.map((u) => `[[image:${u.id}]]`).join(" ");
    lines.push(
      choice === "as_is"
        ? `- ${item.id} (${item.name}): عندي صورته الجاهزة، معتمدة كما هي ولا تحتاج برومبت: ${marks}`
        : choice === "reference"
          ? `- ${item.id} (${item.name}): هذي صورة مرجعية من عندي، اصنع الشيت منها بستايل المشروع: ${marks}`
          : `- ${item.id} (${item.name}): ${ups.length > 1 ? `هذي ${ups.length} صور لشخص حقيقي` : "هذي صورة لشخص حقيقي"}، حوّله إلى شخصية كرتونية بستايل المشروع واصنع منها شيت متكامل مع الحفاظ على ملامحه: ${marks}`,
    );
  }
  // Must really flip the version: a silent no-op here left the map "awaiting approval" with no job started
  const { data: done, error: verErr } = await db()
    .from("film_versions")
    .update({ status: "approved", approved_at: new Date().toISOString(), data: { ...v.data, choices: clean } })
    .eq("id", v.id)
    .eq("status", "awaiting_approval")
    .select("id");
  if (verErr) throw verErr;
  if (!done?.length) throw new UserError("الخريطة ما انعتمدت (تغيّرت حالتها). حدّث الصفحة وجرّب.", 409);
  const text = lines.length ? `اعتمد\n\nمعلومات عن الصور:\n${lines.join("\n")}` : "اعتمد";
  const id = await addUserMessage(project.id, text);
  return queueReply(project, user, id);
}

const FINISH_REQUEST = "كل صور الشيتات صارت معتمدة";

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
  const id = await addUserMessage(project.id, `${FINISH_REQUEST} ومرفقة هنا:\n${list}\n\nجهّز رسالة التسليم النهائية بحالاتها الصحيحة.`);
  return queueReply(project, user, id);
}

/** Generates the picture of an approved sheet prompt, with its references (the master for style only). */
async function generateSheet(project: FilmProject, user: { id: string; email?: string | null }, prompt: SheetVersion, assets: FilmAsset[]) {
  const sheetId = prompt.ref_key;
  if (!prompt.data.prompt) throw new UserError("برومبت هذا الشيت فاضي.", 409);
  const images = approvedImages(assets);
  if (sheetId !== MASTER_ID && !images[MASTER_ID]) throw new UserError("اعتمد صورة الماستر أول؛ هي مرجع الستايل لكل الشيتات.", 409);
  const refIds = new Set((prompt.data.references ?? []).map((r) => r.sheet_id));
  refIds.delete(MASTER_ID);
  refIds.delete(sheetId);
  // The subject's own references come first; the master comes last and is used for style only
  const refs = [...refIds].map((id) => images[id]).filter(Boolean);
  const own = assets.filter((a) => a.kind === "upload" && a.ref_key === sheetId && (a.meta?.mode === "reference" || a.meta?.mode === "convert") && a.status === "uploaded");
  refs.push(...own);
  let text = prompt.data.prompt;
  if (sheetId !== MASTER_ID) {
    refs.push(images[MASTER_ID]);
    text += `\n\n${MASTER_STYLE_ONLY}`;
  }
  await startImage(project, user, { sheetId, prompt: text, refs, kind: "sheet", versionId: prompt.id, meta: {} });
}

/** Creates the asset + paid job for one picture and generates it in the background. */
async function startImage(
  project: FilmProject,
  user: { id: string; email?: string | null },
  o: { sheetId: string; prompt: string; refs: FilmAsset[]; kind: "test" | "sheet"; versionId: string; meta: Record<string, unknown> },
) {
  const running = await runningImageJobs(project.id);
  if (running.length >= MAX_IMAGES_AT_ONCE) throw new UserError("فيه صور تتولد الحين، انتظرها تخلص.", 409);
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
      const f = await storage.from(FILM_BUCKET).download(r.storage_path!);
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
    const up = await storage.from(FILM_BUCKET).upload(path, png, { contentType: "image/png", upsert: true });
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

const KIND_BY_STAGE: Record<number, SheetKind> = { 2: "sheet_understanding", 3: "sheet_questions", 4: "style_test", 5: "sheet_prompt", 6: "sheet_prompt", 7: "sheet_handoff" };

export async function runSheetReply(projectId: string, jobId: string) {
  try {
    const turns = await buildTurns(projectId, STAGE);
    if (turns.at(-1)?.role !== "user") throw new Error("nothing to answer");
    const { data: lastAsk } = await db().from("film_messages").select("content").eq("project_id", projectId).eq("stage", STAGE).eq("role", "user").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (String(lastAsk?.content ?? "").startsWith(BATCH_REQUEST)) return await runSheetBatch(projectId, jobId, turns);
    const result = await callClaudeJson<Reply>({ system: SYSTEM, turns, schema: SHEET_MAKER_SCHEMA, maxTokens: MAX_TOKENS });
    const r = result.data;
    const { data: asked } = await db()
      .from("film_messages")
      .select("content")
      .eq("project_id", projectId)
      .eq("stage", STAGE)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    // The answer to the handoff request is the handoff, whatever stage the reply labels itself with,
    // so the project always moves on to the director once every picture is approved
    const kind = String(asked?.content ?? "").startsWith(FINISH_REQUEST) ? "sheet_handoff" : KIND_BY_STAGE[r.stage];
    if (!kind) throw new Error(`unexpected stage ${r.stage}`);
    // The sheet's own ID when it gives a valid one (a reply labelled stage 5 must not overwrite the master)
    const ref = kind === "sheet_prompt" ? (/^[A-Z]{3}-\d{2}$/.test(r.sheet_id) ? r.sheet_id : r.stage === 5 ? MASTER_ID : r.sheet_id || "?") : "";

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
        suggestion: r.suggestion?.trim() || undefined,
        questions: kind === "sheet_questions" ? r.questions : undefined,
        sheet_map: kind === "sheet_understanding" ? r.sheet_map : undefined,
        prompt: r.prompt || undefined,
        references: r.references?.length ? r.references : undefined,
        // what this reply cost (shown on its card, in coins)
        cost_usd: claudeCost(result.usage),
      },
      // The handoff is passed on in the background and never shown as a step
      status: isHandoff || kind === "style_test" ? "approved" : "awaiting_approval",
      approved_at: isHandoff || kind === "style_test" ? new Date().toISOString() : null,
      created_by: "assistant",
    });
    if (error) throw error;
    // The reply joins the conversation only once its deliverable is stored, so a failure stays retryable
    await client.from("film_messages").insert({ project_id: projectId, stage: STAGE, role: "assistant", content: result.raw });
    // The project moves on before the job reads "done", so the page that sees it finish goes straight to the director
    if (isHandoff) {
      const all = await sheetVersions(projectId);
      const { map } = approvedMap(all);
      const images = approvedImages(await sheetAssets(projectId));
      if (map.length && map.every((m) => images[m.id])) await client.from("film_projects").update({ stage: "director" }).eq("id", projectId);
    }
    await succeedJob(jobId, { costUsd: claudeCost(result.usage), units: totalTokens(result.usage) });
  } catch (err) {
    console.error("sheet maker reply failed", err);
    await failJob(jobId, err);
  }
}

/**
 * Writes the prompt of every sheet still without one, all at the same time: one request per sheet over the same
 * conversation, each delivered as that sheet's Stage 6 prompt (awaiting approval). The replies join the conversation
 * as one message, so later edits and the handoff see them all.
 */
async function runSheetBatch(projectId: string, jobId: string, turns: Awaited<ReturnType<typeof buildTurns>>) {
  const client = db();
  const versions = await sheetVersions(projectId);
  const pending = pendingSheets(versions);
  if (!pending.length) throw new Error("no sheets left to write");
  const results = await Promise.allSettled(
    pending.map(async (item) => {
      const ask = turns.map((t, i) =>
        i === turns.length - 1
          ? {
              ...t,
              content: [
                ...(typeof t.content === "string" ? [{ type: "text" as const, text: t.content }] : t.content),
                { type: "text" as const, text: `\n\nفي هذا الطلب بالذات: سلّم برومبت ${item.id} (${item.name}) فقط، كاملًا بصيغة المرحلة 6 (stage 6, sheet_id "${item.id}"). الموقع يطلب باقي الشيتات بالتوازي في طلبات مستقلة، فلا تكتبها هنا ولا تنتظر اعتماد غيره.` },
              ],
            }
          : t,
      );
      const result = await callClaudeJson<Reply>({ system: SYSTEM, turns: ask, schema: SHEET_MAKER_SCHEMA, maxTokens: MAX_TOKENS });
      return { item, result };
    }),
  );
  const done = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const cost = done.reduce((n, d) => n + claudeCost(d.result.usage), 0);
  const tokens = done.reduce((n, d) => n + totalTokens(d.result.usage), 0);
  if (!done.length) {
    const why = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw why?.reason ?? new Error("no sheet prompt came back");
  }
  for (const { item, result } of done) {
    const r = result.data;
    const same = versions.filter((v) => v.kind === "sheet_prompt" && v.ref_key === item.id);
    const old = same.filter((v) => v.status === "awaiting_approval" || v.status === "draft").map((v) => v.id);
    if (old.length) await client.from("film_versions").update({ status: "superseded" }).in("id", old);
    const { error } = await client.from("film_versions").insert({
      project_id: projectId, stage: STAGE, kind: "sheet_prompt", ref_key: item.id, version: (same.at(-1)?.version ?? 0) + 1, body: r.content,
      data: { notes: r.notes, suggestion: r.suggestion?.trim() || undefined, prompt: r.prompt || undefined, references: r.references?.length ? r.references : undefined, cost_usd: claudeCost(result.usage) },
      status: "awaiting_approval", created_by: "assistant",
    });
    if (error) throw error;
  }
  const missing = pending.filter((m) => !done.some((d) => d.item.id === m.id));
  const text = [
    `سلّمت برومبتات الشيتات التالية دفعة واحدة، وكل واحد ينتظر "اعتمد" أو تعديل:`,
    ...done.map(({ item, result }) => `## ${item.id} · ${item.name}\n${result.data.content}`),
    ...(missing.length ? [`ما اكتملت بعد: ${missing.map((m) => m.id).join("، ")}`] : []),
  ].join("\n\n");
  await client.from("film_messages").insert({ project_id: projectId, stage: STAGE, role: "assistant", content: text });
  await succeedJob(jobId, { costUsd: cost, units: tokens });
}

/** Upload of the user's own picture for one map item (step 1: one-time signed URL). */
export async function sheetUploadUrl(project: FilmProject, sheetId: string, mime: string) {
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[mime];
  if (!ext || !/^[A-Z]{3}-\d{2}$/.test(sheetId)) throw new UserError("صورة JPG أو PNG أو WEBP فقط.", 400);
  const path = `${projectDir(project)}/sheets/upload-${sheetId}-${Date.now()}.${ext}`;
  const { data, error } = await storage.from(FILM_BUCKET).createSignedUploadUrl(path);
  if (error) throw error;
  return { path: data.path, token: data.token };
}

/** Step 2: records the uploaded picture against its map item. */
export async function confirmSheetUpload(project: FilmProject, sheetId: string, path: string, mode: MapChoice = "as_is") {
  const dir = `${projectDir(project)}/sheets`;
  if (!path.startsWith(`${dir}/upload-${sheetId}-`) || path.includes("..")) throw new UserError("ملف غير صحيح.", 400);
  const name = path.slice(dir.length + 1);
  const { data: list } = await storage.from(FILM_BUCKET).list(dir, { search: name });
  const file = list?.find((f) => f.name === name);
  const size = Number(file?.metadata?.size ?? 0);
  if (!file || size <= 0 || size > 20 * 1024 * 1024) throw new UserError("ما وصل الملف أو حجمه أكبر من ٢٠ ميجا.", 400);
  if (multiUpload(mode)) {
    const { count } = await db().from("film_assets").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("kind", "upload").eq("ref_key", sheetId).neq("status", "rejected");
    if ((count ?? 0) >= MAX_REFERENCE_UPLOADS) throw new UserError(`الحد الأقصى ${MAX_REFERENCE_UPLOADS} صور لكل عنصر.`, 400);
  } else {
    // "As is": only the latest upload counts for this item
    await db().from("film_assets").update({ status: "rejected" }).eq("project_id", project.id).eq("kind", "upload").eq("ref_key", sheetId);
  }
  const { error } = await db().from("film_assets").insert({
    project_id: project.id, kind: "upload", ref_key: sheetId, storage_path: path, file_name: name,
    mime: String(file.metadata?.mimetype ?? ""), bytes: size, status: "uploaded", meta: {},
  });
  if (error) throw error;
}

const UNDERSTAND_SCHEMA = { type: "object", additionalProperties: false, required: ["understanding"], properties: { understanding: { type: "string" } } } as const;

/**
 * «تأكد من فهمي»: the edit restated in two or three short Arabic lines (what changes in the sheet, what stays), from the
 * sheet's current prompt — nothing written to the conversation, nothing drawn. Charged as a small reply.
 */
async function understandEdit(project: FilmProject, user: { id: string; email?: string | null }, o: { id: string; name: string; prompt: string; text: string }) {
  const { job } = await startJob({ projectId: project.id, user, service: "anthropic", operation: STAGE, idempotencyKey: `understand:${crypto.randomUUID()}`, estimateUsd: 0.05, units: 0, unit: "tokens" });
  try {
    const r = await callClaudeJson<{ understanding: string }>({
      system: "You are the sheet maker of an Arabic film studio. The person wants to change one character or environment sheet. Restate in Gulf Arabic, in 2–3 short lines, exactly what you understood will change in the picture and what stays the same. Do not write a prompt, do not ask anything else, do not judge.",
      turns: [{ role: "user", content: `الشيت: ${o.id} · ${o.name}\n\nوصفه الحالي (برومبت إنجليزي):\n${o.prompt.slice(0, 6000)}\n\nتعديلي:\n${o.text}` }],
      schema: UNDERSTAND_SCHEMA,
      maxTokens: 1200,
      effort: "low",
    });
    await succeedJob(job.id, { costUsd: claudeCost(r.usage), units: totalTokens(r.usage) });
    return r.data.understanding.trim();
  } catch (e) {
    await failJob(job.id, e);
    throw new UserError("ما قدرت أفهم التعديل الحين؛ جرّب مرة ثانية.", 502);
  }
}

/**
 * A series' scene takes a character, a place or the style from its series as its sheet, as it is: the series' picture
 * is copied in as this sheet's ready picture (chosen «📚 من المسلسل» on the map).
 */
export async function takeSeriesCast(project: FilmProject, sheetId: string, castId: unknown) {
  if (!project.series_id) throw new UserError("هذا مو مشهد من مسلسل.", 400);
  if (!/^[A-Z]{3}-\d{2}$/.test(sheetId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: c } = await db().from("film_series_cast").select("id,name,storage_path,status").eq("id", String(castId)).eq("series_id", project.series_id).maybeSingle();
  if (!c?.storage_path || c.status !== "ready") throw new UserError("صورتها في المسلسل مو جاهزة بعد.", 409);
  const name = `upload-${sheetId}-${Date.now()}.png`;
  const path = `${projectDir(project)}/sheets/${name}`;
  const copied = await storage.from(FILM_BUCKET).copy(c.storage_path, path);
  if (copied.error) throw new UserError("ما قدرنا ننسخ الصورة؛ جرّب مرة ثانية.", 502);
  await db().from("film_assets").update({ status: "rejected" }).eq("project_id", project.id).eq("kind", "upload").eq("ref_key", sheetId);
  const { error } = await db().from("film_assets").insert({
    project_id: project.id, kind: "upload", ref_key: sheetId, storage_path: path, file_name: name, mime: "image/png", status: "uploaded", meta: { series_cast: c.id, series_name: c.name },
  });
  if (error) throw error;
}
