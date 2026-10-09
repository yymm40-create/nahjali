// «الجواد الذكي!» | JAWAD AI — generation jobs. Server only.
//
//   click ─► createJob: re-check everything on the server (registry, stored files, current prices), compare the price
//            the user saw, then ONE database call creates the job and takes its coins (or refuses: no job, no charge).
//            The click's idempotency key makes any repeat return the same job.
//   after ─► runJob: claims the job, sends it to the provider (never retried blindly), saves results to our storage.
//   poll / callback / daily sweep ─► advanceJob: reads the provider's real state, saves finished videos, gives up on
//            stale work, and finds tasks whose creation answer was lost (instead of sending a second one).
//   end ─► jawad_finish_job: exactly once; success keeps the charge, failure or cancellation refunds it.

import { coinStr } from "@config/coins";
import { MINIMAX_PRICE, minimaxSpeech } from "./providers/minimax";
import { jawadSpeak } from "./providers/jawad-voice";
import { jawadReference } from "./voices";
import { can, permForGenerator } from "@/lib/access";
import { PERMS } from "@config/access";
import { holdTeamCoins, refundTeamCoins } from "@/lib/coins";
import { giveAttempt } from "@/lib/film/team";
import { after } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { dictionOf, ELEVEN_PRICE, generatorById, GPT_IMAGE_2_SIZES, JAWAD_VOICE_PRICE, MUSIC_REF_MS, MUSIC_REF_USE } from "@config/jawad/generators";
import type { HabibiDialect } from "../voice-text";
import { MAX_ACTIVE_JOBS } from "@config/jawad/brand";
import type { GeneratorDef, RefRole, RefStyle, Settings } from "@config/jawad/types";
import { evaluate, priceVersion } from "../engine";
import { cleanRefName, defaultRefName, promptForModel } from "../mentions";
import { probe, sniff } from "../media";
import { loadRuntime, JAWAD_BUCKET } from "./runtime";
import { refsFor, type UploadRow } from "./uploads";
import { ProviderError, providerUserId } from "./providers/common";
import { openaiImage, openaiSpeech, TTS_MIME } from "./providers/openai";
import { arkCancelTask, arkCreateTask, arkGetTask, arkListTasks, type ArkContent, type ArkTask } from "./providers/modelark";
import { prepareEdit, type EditInputs } from "./smart-edit";
import { elevenMusic, elevenMusicWithReference, elevenSoundEffect, elevenSpeech } from "./providers/elevenlabs";
import { resolveVoice } from "./voices";
import { prepareSpeech } from "./diction";
import { makeSmartSplit, removeFrames, storeFrames, videoHasSound, type VideoInputs } from "./smart-split";
import { keepMadeItem } from "./library";
import { libraryAccess, libraryNames } from "./library-access";
import type { LibraryKind } from "@config/jawad/library";
import { needsFrames, SMART_SPLIT_ID, SMART_SPLIT_MODE, stemsOf, type Stem } from "@config/jawad/smart-split";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();

export type JobStatus = "queued" | "submitting" | "running" | "saving" | "succeeded" | "failed" | "cancelled";
const OPEN: JobStatus[] = ["queued", "submitting", "running", "saving"];

export interface JobRow {
  id: string;
  user_id: string;
  idempotency_key: string;
  section_id: string;
  generator_id: string;
  provider: string;
  model_id: string;
  mode: string;
  output_kind: "image" | "video" | "audio";
  prompt: string;
  /**
   * modelPrompt: the prompt as the model receives it (each «@name» written the model's way, or Arabic words written
   * phonetically by «النطق الدقيق»), when it differs. diction: the words whose pronunciation was set.
   */
  inputs: { settings: Settings; instructions?: string; refStyle?: RefStyle; origin?: string; saveAttempts?: number; modelPrompt?: string; edit?: EditInputs; video?: VideoInputs; sfx?: VideoInputs; library?: { kind: LibraryKind; name: string; note: string }; diction?: { mode: string; words: { word: string; vocalized: string }[] }; film?: { projectId: string; assetId?: string; genId?: string; title?: string } };
  refs: { uploadId: string; kind: string; role: RefRole; name?: string }[];
  price_coins: number;
  price_breakdown: { label: string; centi: number }[];
  pricing_version: string;
  charged: boolean;
  charge_state: "none" | "held" | "settled" | "refunded";
  status: JobStatus;
  submit_state: "pending" | "sending" | "accepted" | "unknown" | "rejected";
  progress: number | null;
  provider_task_id: string | null;
  provider_status: string | null;
  submitted_at: string | null;
  error_message: string | null;
  error_detail: string | null;
  cost_usd_estimate: number | null;
  cost_usd_actual: number | null;
  provider_units: Record<string, unknown> | null;
  lease_until: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutputRow {
  id: string;
  job_id: string;
  user_id: string;
  kind: "image" | "video" | "audio";
  idx: number;
  storage_path: string;
  mime: string;
  bytes: number | null;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  created_at: string;
}

/** How long a worker may hold a job before another request may take over (longer than the provider timeout + saving). */
const LEASE_MS = 7 * 60_000;
/** The request that started a video keeps watching it this long; polling and the callback do the rest. */
const WATCH_MS = 200_000;
/** A video task never runs longer than this on our side (ModelArk expires it at 2 h). */
const VIDEO_STALE_MS = 2 * 3600_000 + 15 * 60_000;
/** How long we look for a task whose creation answer was lost before refunding. */
const UNKNOWN_GIVE_UP_MS = 15 * 60_000;
const MAX_SAVE_ATTEMPTS = 4;

const now = () => new Date().toISOString();
const later = (ms: number) => new Date(Date.now() + ms).toISOString();
const coinLabel = (d: GeneratorDef | undefined) => `JAWAD AI · ${d?.name ?? "توليد"}`;

async function event(jobId: string, type: string, detail: Record<string, unknown> = {}) {
  await db().from("jawad_job_events").insert({ job_id: jobId, type, detail });
}

/** Ends a job exactly once (refunds held coins unless it succeeded). Returns false if it had already ended. */
/**
 * What really went wrong, in plain Arabic, from the provider's or Claude's own answer (the generic message stays when
 * nothing is recognised). The provider's code goes along in brackets so it can be looked up.
 */
export function explainFailure(detail: string | undefined, fallback: string | undefined) {
  const d = detail ?? "";
  const code = /\b([A-Z][A-Za-z]+(?:\.[A-Z][A-Za-z]+)?)\b/.exec(d.replace(/^smart edit prompt: /, ""))?.[1];
  const tag = (m: string) => (code && /Sensitive|Policy|Limit|Quota/.test(code) ? `${m} (${code})` : m);
  if (/credit balance is too low/i.test(d)) return "رصيد Claude (Anthropic) عند المنصة خلص، فما قدر يكتب البرومبت المعدّل. أُعيدت لك نقودك. صاحب المنصة لازم يشحن رصيد Anthropic.";
  if (/OutputVideoSensitiveContentDetected/.test(d) && /copyright/i.test(d)) return tag("رفض المزوّد الفيديو الناتج لأنه يشبه محتوى محمي بحقوق نشر (لاعب أو شخص مشهور، شعار، لبس فريق، شخصية معروفة). غيّر الملاحظة أو المراجع لتبعد عن هذا الشبه وجرّب. ما انخصم منك شي.");
  if (/OutputAudioSensitiveContentDetected/.test(d) && /copyright/i.test(d)) return tag("رفض المزوّد الصوت الناتج لأنه يشبه موسيقى أو صوتًا محميًا بحقوق نشر. اطلب صوتًا عاديًا بدون موسيقى معروفة، أو أطفئ الصوت وجرّب. ما انخصم منك شي.");
  if (/Output(Video|Audio)SensitiveContentDetected/.test(d)) return tag("رفض المزوّد النتيجة لأنها خالفت سياسة المحتوى عنده. غيّر الملاحظة وجرّب. ما انخصم منك شي.");
  if (/InputImageSensitiveContentDetected/.test(d)) return tag("رفض المزوّد صورة المرجع أو لقطة القص (فيها شخص حقيقي أو محتوى حساس عنده). جرّب «كامل» أو جزءًا ثانيًا. ما انخصم منك شي.");
  if (/InputTextSensitiveContentDetected/.test(d)) return tag("رفض المزوّد نص الطلب لأنه خالف سياسة المحتوى عنده. غيّر كلمات الملاحظة وجرّب. ما انخصم منك شي.");
  // the provider reads even stylised or cartoon footage as «private information» now and then: «كامل» sends no video reference at all
  if (/InputVideoSensitiveContentDetected/.test(d)) return "رفض المزوّد مقطع الاستمرارية (قدّره محتوى فيه معلومات خاصة، وهذا يحصل أحيانًا حتى مع الكرتون والمجسّمات). جرّب «أعد المقطع كاملًا»: ما يرسل أي مرجع فيديو. ما انخصم منك شي. (InputVideoSensitiveContentDetected)";
  if (/InputVideo/.test(d)) return `رفض المزوّد مقطع الفيديو المرجعي (الاستمرارية): ${d.slice(0, 200)}. جرّب «أعد المقطع كاملًا» أو مقاطع استمرارية أطول. ما انخصم منك شي.`;
  if (/InputAudio/.test(d)) return `رفض المزوّد الصوت المرجعي: ${d.slice(0, 200)}. أطفئ الصوت أو جرّب بدون مقاطع الصوت. ما انخصم منك شي.`;
  if (/SensitiveContent|PolicyViolation/.test(d)) return tag("رفض المزوّد الطلب لأنه خالف سياسة المحتوى عنده. غيّر الملاحظة وجرّب. ما انخصم منك شي.");
  // the platform's own account at the provider (billing), not the person's: never «busy»
  if (/AccountOverdue|OverdueBalance|BalanceNotEnough|InsufficientBalance|ArrearsError/i.test(d)) return "توقف مزوّد الفيديو عن قبول الطلبات بسبب حساب المنصة عنده (مستحقات أو رصيد)، وليس بسبب طلبك. أبلغ صاحب المنصة. أُعيدت لك نقودك. (AccountOverdueError)";
  if (/rate.?limit|RateLimit|429|overloaded|Quota/i.test(d)) return tag("المزوّد مشغول الحين أو وصل حده. جرّب بعد دقائق. ما انخصم منك شي.");
  if (/InvalidParameter|Unsupported|Invalid|MissingParameter/.test(d)) return `المزوّد رفض الطلب لأن أحد المراجع أو الإعدادات غير مقبول عنده: ${d.slice(0, 220)}. ما انخصم منك شي.`;
  if (/InternalServiceError|ServiceUnavailable|InternalError|ServerError/.test(d)) return `خطأ داخلي عند المزوّد (${d.slice(0, 120)}). جرّب مرة ثانية بعد دقائق. ما انخصم منك شي.`;
  // nothing recognised: the provider's own words go along, so the reason is never hidden
  const raw = d.replace(/^smart edit prompt: /, "").replace(/\s+/g, " ").trim();
  return fallback && raw && !/^(failed|expired|cancelled)$/.test(raw) ? `${fallback} السبب عند المزوّد: ${raw.slice(0, 220)}` : fallback;
}

export async function finishJob(job: Pick<JobRow, "id" | "generator_id">, status: "succeeded" | "failed" | "cancelled", o: { message?: string; detail?: string; costUsd?: number | null; units?: Record<string, unknown> } = {}) {
  const { data, error } = await db().rpc("jawad_finish_job", {
    p_job: job.id,
    p_status: status,
    p_error_message: status === "failed" ? (explainFailure(o.detail, o.message) ?? null) : (o.message ?? null),
    p_error_detail: o.detail?.slice(0, 2000) ?? null,
    p_cost_usd: o.costUsd ?? null,
    p_units: o.units ?? null,
    p_label: coinLabel(generatorById(job.generator_id)),
  });
  if (error) throw error;
  // a team series' generation that didn't succeed: the team's coins and the member's attempt go back
  if (data && status !== "succeeded") {
    const held = await refundTeamCoins(job.id).catch(() => null);
    if (held?.userId) await giveAttempt(held.seriesId, held.userId).catch(() => {});
  }
  return Boolean(data);
}

// ───────────────────────────── create ─────────────────────────────

export interface GenerateBody {
  idempotencyKey?: unknown;
  sectionId?: unknown;
  generatorId?: unknown;
  refStyle?: unknown;
  settings?: unknown;
  prompt?: unknown;
  instructions?: unknown;
  refs?: unknown;
  expectedCoins?: unknown;
  /** «الفصل الذكي»: small JPEG frames of the video, `{ t, data: "data:image/jpeg;base64,…" }`. */
  frames?: unknown;
}

export type CreateResult =
  | { kind: "created" | "existing"; job: JobRow; balance: number | null }
  | { kind: "issues"; issues: { field: string; message: string }[] }
  | { kind: "price_changed"; coins: number; lines: { label: string; centi: number }[]; prices: Record<string, number | null> };

const ROLES: RefRole[] = ["first_frame", "last_frame", "reference"];

/**
 * `server.library`: set only by the server (never from the request), for a character or place of «المكتبة» made from a
 * description; its picture is kept in the library when the job succeeds.
 */
export async function createJob(user: { id: string; email?: string | null }, owner: boolean, b: GenerateBody, origin: string, server: { library?: { kind: LibraryKind; name: string; note: string }; team?: string | null; via?: "editor" | "content" } = {}): Promise<CreateResult> {
  const key = String(b.idempotencyKey ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  const def = generatorById(String(b.generatorId ?? ""));
  if (!def) throw new UserError("المولد غير معروف.", 400);
  // the dashboard's list: this branch (images, video, voices, music) for this person; «حيدرة» makes with its own right,
  // and «محمد باقر» makes through جواد's desk (src/lib/content/jawad.ts) with the door he already passed
  // (the owner's switch in /admin/content already decided who gets in there: requireContentUser, before any request reaches the desk)
  const perm = server.via === "editor" ? "editor_ai" : permForGenerator(def);
  if (server.via !== "content" && !(await can(user.email, perm))) throw new UserError(`${PERMS.find((x) => x.key === perm)!.label.replace(/^\S+\s/, "")} مقفلة لحسابك حاليًا.`, 403);

  // The same click again: the job it already made (no new check, no new charge)
  const existing = await db().from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle();
  if (existing.data) return { kind: "existing", job: existing.data as JobRow, balance: null };

  const rt = await loadRuntime();
  if (!rt.migrated) throw new UserError("منصة JAWAD AI قيد التجهيز (قاعدة البيانات).", 503);
  const rg = rt.generators.find((g) => g.id === def.id)!;
  if (!(rg.live || (owner && rg.keyConfigured))) throw new UserError("هذا المولد غير متاح حاليًا.", 403);
  const section = rt.sections.find((s) => s.id === b.sectionId && s.output === def.output && (s.enabled || owner));
  if (!section || rg.sectionId !== section.id) throw new UserError("هذا المولد لا يتبع هذا القسم.", 400);

  const rawRefs = Array.isArray(b.refs) ? b.refs.slice(0, 60) : [];
  const refStyle: RefStyle = b.refStyle === "frames" || b.refStyle === "references" ? b.refStyle : "none";
  const wanted = rawRefs.map((r) => {
    const x = (r ?? {}) as { uploadId?: unknown; role?: unknown; name?: unknown };
    const role = refStyle === "frames" && ROLES.includes(x.role as RefRole) ? (x.role as RefRole) : "reference";
    return { uploadId: String(x.uploadId ?? ""), role, name: cleanRefName(x.name) };
  });
  // Frames go first frame, then last frame: the order the model numbers them in
  if (refStyle === "frames") wanted.sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role));
  const found = await refsFor(user.id, wanted);
  // A character or place of «المكتبة» is used while the add-on runs (the owner always)
  const kept = await libraryNames(found.rows.map((r) => r.id));
  if (kept.length && !(await libraryAccess(user.id, owner)).active) {
    return { kind: "issues", issues: [{ field: "refs", message: `«@${kept[0]}» من مكتبتك، و«المكتبة» مقفلة الآن. فعّل اشتراكها أو احذف هذا المرجع.` }] };
  }
  // Every reference has a name: the one chosen, else the next default of its type (image1, video1…)
  const given = wanted.flatMap((w) => (w.name ? [w.name] : []));
  const meta = found.meta.map((m, i) => {
    const name = wanted[i].name ?? defaultRefName(m.kind, given);
    if (!wanted[i].name) given.push(name);
    return { ...m, name };
  });
  const settings = (b.settings && typeof b.settings === "object" ? b.settings : {}) as Settings;
  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  // A performance description is only for generators that take one (a page left from another generator may send it)
  const instructions = def.extraText && typeof b.instructions === "string" ? b.instructions : "";
  if (prompt.length > 40_000 || instructions.length > 5_000) throw new UserError("النص طويل جدًا.", 400);

  const table = rt.prices[def.id];
  const e = evaluate(def, { settings, prompt, instructions, refStyle, refs: meta, strict: true }, table);
  if (e.issues.length) return { kind: "issues", issues: e.issues };
  // A voice must really exist: one of ElevenLabs' ready voices, or one in the person's own library
  if (def.options.some((o) => o.kind === "choice" && o.picker === "voice")) {
    const v = await resolveVoice(user.id, String(e.settings.voice));
    if (!v.ok) return { kind: "issues", issues: [{ field: "voice", message: v.reason }] };
  }
  // «الفصل الذكي»: the dialogue comes from the video's own sound, so the video must have one
  const splitVideo = e.mode.id === SMART_SPLIT_MODE ? found.rows.find((r) => r.kind === "video") : undefined;
  if (splitVideo && e.settings.dialogue === true && !(await videoHasSound(splitVideo.storage_path))) {
    return { kind: "issues", issues: [{ field: "dialogue", message: "هذا الفيديو بلا صوت، فلا يوجد حوار لفصله. ألغِ «الحوار» أو اختر فيديو فيه صوت." }] };
  }
  if (!e.price.ok) return { kind: "issues", issues: [{ field: "price", message: e.price.reason }] };
  // The user confirms the exact amount: any difference (a price changed since the page loaded) is asked again
  if (Number(b.expectedCoins) !== e.price.coins) return { kind: "price_changed", coins: e.price.coins, lines: e.price.lines, prices: table };

  // «الفصل الذكي»: the frames the studio took of the video are kept with the job (Claude watches them for the music
  // and the effects; the dialogue needs only the video)
  let video: VideoInputs | undefined;
  if (e.mode.id === SMART_SPLIT_MODE) {
    const durationMs = meta.find((m) => m.kind === "video")?.durationMs ?? 0;
    if (needsFrames(e.settings)) {
      if (!process.env.ANTHROPIC_API_KEY) throw new UserError("الفصل الذكي غير متاح حاليًا.", 503);
      video = await storeFrames(user.id, key, b.frames, durationMs);
    } else video = { durationMs, frames: [] };
  }

  // What the model reads: each «@name» written the way it numbers references (the user's prompt is kept as written)
  const modelPrompt = def.refLabel ? promptForModel(prompt, meta, def.refLabel).text : prompt;

  // made inside a team series' edit («المسلسل الذكي»): its «نقود الفريق الذكي» pays, not the person's own coins
  const teamPays = !owner && !!server.team && e.price.coins > 0;
  const charge = !owner && !server.team && e.price.coins > 0;
  const { data, error } = await db().rpc("jawad_create_job", {
    p_job: {
      user_id: user.id,
      idempotency_key: key,
      section_id: section.id,
      generator_id: def.id,
      provider: def.provider.id,
      model_id: def.model.id,
      mode: e.mode.id,
      output_kind: def.output,
      prompt,
      inputs: { settings: e.settings, instructions, refStyle, origin, ...(modelPrompt !== prompt ? { modelPrompt } : {}), ...(video ? { video } : {}), ...(server.library ? { library: server.library } : {}) },
      refs: meta.map((m) => ({ uploadId: m.id, kind: m.kind, role: m.role, name: m.name })),
      price_coins: e.price.coins,
      price_breakdown: e.price.lines,
      pricing_version: priceVersion(table),
      cost_usd_estimate: e.price.usdCeiling ?? "",
    },
    p_charge: charge,
    p_max_active: MAX_ACTIVE_JOBS,
    p_label: coinLabel(def),
  });
  if (error) {
    // No job: the frames kept for it go too
    if (video) await removeFrames(video);
    const msg = String(error.message ?? "");
    if (msg.includes("JAWAD_INSUFFICIENT")) throw new UserError(`رصيدك من النقود الذكية لا يكفي: هذا التوليد يحتاج ${coinStr(e.price.coins)}.`, 402);
    if (msg.includes("JAWAD_BUSY")) throw new UserError(`عندك ${MAX_ACTIVE_JOBS} توليدات قيد العمل. انتظر حتى ينتهي أحدها.`, 429);
    throw error;
  }
  const row = (data as { job_id: string; created: boolean; balance: number | null }[])[0];
  const { data: job } = await db().from("jawad_jobs").select("*").eq("id", row.job_id).single();
  if (row.created && teamPays) {
    try {
      await holdTeamCoins(server.team!, user, e.price.coins, row.job_id, coinLabel(def));
    } catch (err) {
      await finishJob(job as JobRow, "cancelled", { message: "رصيد نقود الفريق الذكي ما يكفي." }).catch(() => {});
      throw err;
    }
  }
  if (row.created) after(() => runJob(row.job_id));
  return { kind: row.created ? "created" : "existing", job: job as JobRow, balance: row.balance };
}

// ───────────────────────────── run ─────────────────────────────

/** Takes a queued job (only one worker ever does) and sends it. */
export async function runJob(jobId: string) {
  const { data } = await db()
    .from("jawad_jobs")
    .update({ status: "submitting", submit_state: "sending", submitted_at: now(), lease_until: later(LEASE_MS) })
    .eq("id", jobId)
    .eq("status", "queued")
    .eq("submit_state", "pending")
    .select("*");
  let job = (data?.[0] ?? null) as JobRow | null;
  if (!job) return;
  const def = generatorById(job.generator_id);
  try {
    if (!def) throw new ProviderError("rejected", "المولد لم يعد متاحًا.", `unknown generator ${job.generator_id}`);
    // «التعديل الذكي»: جواد writes the final prompt first (from the person's own words and the whole shot)
    if (job.inputs.edit && !job.inputs.edit.done) job = await prepareEdit(job);
    const { rows } = await refsFor(job.user_id, job.refs.map((r) => ({ uploadId: r.uploadId, role: r.role }))).catch(() => {
      throw new ProviderError("rejected", "أحد المراجع حُذف قبل الإرسال. لم يُخصم منك شيء.", "reference missing at submit");
    });
    if (def.provider.id === "byteplus-modelark") await submitVideo(job, def, rows);
    else await runSync(job, def, rows);
  } catch (e) {
    await failFromError(job!, def, e);
  }
}

async function failFromError(job: JobRow, def: GeneratorDef | undefined, e: unknown) {
  const p = e instanceof ProviderError ? e : new ProviderError("unknown", "صار خطأ غير متوقع أثناء التوليد.", String(e instanceof Error ? e.stack ?? e.message : e));
  console.error("jawad job failed", job.id, p.detail);
  // An async provider may have the task: look for it instead of refunding (and never send it twice)
  if (p.outcome === "unknown" && def?.api.tracking === "async" && !job.provider_task_id) {
    await db().from("jawad_jobs").update({ submit_state: "unknown", lease_until: null, error_detail: p.detail.slice(0, 2000) }).eq("id", job.id);
    await event(job.id, "submit_unknown", { detail: p.detail.slice(0, 300) });
    return;
  }
  if (p.outcome === "unknown") await db().from("jawad_jobs").update({ submit_state: "unknown" }).eq("id", job.id);
  else if (job.submit_state !== "accepted") await db().from("jawad_jobs").update({ submit_state: "rejected" }).eq("id", job.id);
  await finishJob(job, "failed", { message: p.userMessage, detail: p.detail });
}

async function download(path: string) {
  const { data, error } = await storage.from(JAWAD_BUCKET).download(path);
  if (error || !data) throw new ProviderError("rejected", "تعذّر قراءة أحد المراجع.", `download ${path}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

/** Saves one result (`name`: what it is, when a job makes several kinds, e.g. «الفصل الذكي»'s tracks). */
async function saveOutput(job: JobRow, idx: number, file: Buffer, mime: string, ext: string, dims: { width?: number | null; height?: number | null; durationMs?: number | null }, name?: string) {
  const path = `${job.user_id}/outputs/${job.id}/${name ?? idx}.${ext}`;
  const up = await storage.from(JAWAD_BUCKET).upload(path, file, { contentType: mime, upsert: true });
  if (up.error) throw new Error(`storage upload: ${up.error.message}`);
  const { error } = await db()
    .from("jawad_outputs")
    .upsert(
      { job_id: job.id, user_id: job.user_id, kind: job.output_kind, idx, storage_path: path, mime, bytes: file.length, width: dims.width ?? null, height: dims.height ?? null, duration_ms: dims.durationMs ?? null },
      { onConflict: "job_id,idx" },
    );
  if (error) throw new Error(`output row: ${error.message}`);
}

/** OpenAI image / speech: one request returns the result; it is saved before the job is called done. */
async function runSync(job: JobRow, def: GeneratorDef, refs: UploadRow[]) {
  const s = job.inputs.settings;
  await db().from("jawad_jobs").update({ status: "running", submit_state: "accepted", provider_status: "generating" }).eq("id", job.id);
  await event(job.id, "submitted");

  if (def.output === "image") {
    const res = await openaiImage({
      model: def.model.id,
      prompt: job.inputs.modelPrompt ?? job.prompt,
      aspect: String(s.aspect),
      resolution: s.resolution === "hi" ? "hi" : "std",
      quality: (["low", "medium", "high"].includes(String(s.quality)) ? s.quality : "medium") as "low" | "medium" | "high",
      count: Number(s.count) || 1,
      references: await Promise.all(refs.map(async (r) => ({ bytes: await download(r.storage_path), mime: r.mime ?? "image/png" }))),
      user: providerUserId(job.user_id),
    });
    await db().from("jawad_jobs").update({ status: "saving", lease_until: later(LEASE_MS) }).eq("id", job.id);
    const size = GPT_IMAGE_2_SIZES[s.resolution === "hi" ? "hi" : "std"][String(s.aspect)];
    for (const [i, png] of res.images.entries()) await saveOutput(job, i, png, "image/png", "png", { width: size?.[0], height: size?.[1] });
    // «المكتبة»: a character or place made from a description is kept under its name (the picture stays in the works
    // either way, and can be added to the library by hand if this fails)
    if (job.inputs.library) await keepMadeItem(job).catch((e) => event(job.id, "library_keep_failed", { error: String(e instanceof Error ? e.message : e).slice(0, 300) }));
    await finishJob(job, "succeeded", { costUsd: res.costUsd, units: res.usage ? { ...res.usage } : undefined });
    return;
  }

  if (def.provider.id === "elevenlabs") return runEleven(job, def, refs);
  if (def.provider.id === "minimax") {
    const voice = await resolveVoice(job.user_id, String(s.voice));
    if (!voice.ok) throw new ProviderError("rejected", voice.reason, `voice ${String(s.voice)}`);
    if (voice.provider !== "minimax") throw new ProviderError("rejected", "هذا الصوت من ElevenLabs؛ اختر صوت MiniMax أو صوتًا نسخته في MiniMax.", `voice provider ${voice.provider}`);
    const arabic = /[\u0600-\u06FF]/.test(job.prompt);
    const emotion = String(s.emotion ?? "auto");
    const r = await minimaxSpeech({ voiceId: voice.voiceId, text: job.prompt, model: "hd", speed: Number(s.speed) || 1, ...(emotion !== "auto" ? { emotion } : {}), ...(arabic ? { languageBoost: "Arabic" } : {}) });
    await db().from("jawad_jobs").update({ status: "saving", lease_until: later(LEASE_MS) }).eq("id", job.id);
    await saveOutput(job, 0, r.audio, "audio/mpeg", "mp3", { durationMs: r.durationMs ?? undefined });
    await finishJob(job, "succeeded", { costUsd: (job.prompt.length / 1000) * MINIMAX_PRICE.hdPerKChars, units: { characters: job.prompt.length } });
    return;
  }

  if (def.provider.id === "jawad") {
    // «صوت الجواد»: the person's own reference recording speaks the text (Habibi on our endpoint, or Chatterbox on fal)
    const voice = await resolveVoice(job.user_id, String(s.voice));
    if (!voice.ok) throw new ProviderError("rejected", voice.reason, `voice ${String(s.voice)}`);
    if (voice.provider !== "jawad") throw new ProviderError("rejected", "هذا الصوت محفوظ عند مزوّد آخر؛ خذ بصمة صوتك في «صوت الجواد» واخترها.", `voice provider ${voice.provider}`);
    const engine = s.engine === "habibi" || s.engine === "chatterbox" ? s.engine : undefined;
    const dialect = typeof s.dialect === "string" ? (s.dialect as HabibiDialect) : undefined;
    const r = await jawadSpeak({ refUrl: await jawadReference(voice.voiceId), refText: voice.refText ?? "", text: job.prompt, engine, dialect, speed: Number(s.speed) || 1 });
    await db().from("jawad_jobs").update({ status: "saving", lease_until: later(LEASE_MS) }).eq("id", job.id);
    await saveOutput(job, 0, r.audio, "audio/wav", "wav", { durationMs: r.durationMs ?? undefined });
    await finishJob(job, "succeeded", { costUsd: (job.prompt.length / 1000) * (r.engine === "habibi" ? JAWAD_VOICE_PRICE.habibiPerKChars : JAWAD_VOICE_PRICE.chatterboxPerKChars), units: { characters: job.prompt.length, engine: r.engine } });
    return;
  }

  if (def.output === "audio") {
    const format = String(s.format);
    const audio = await openaiSpeech({ model: def.model.id, input: job.prompt, instructions: job.inputs.instructions ?? "", voice: String(s.voice), format });
    await db().from("jawad_jobs").update({ status: "saving", lease_until: later(LEASE_MS) }).eq("id", job.id);
    const bytes = new Uint8Array(audio);
    const sn = sniff(bytes);
    const durationMs = sn ? probe(bytes, sn).durationMs : undefined;
    await saveOutput(job, 0, audio, TTS_MIME[format] ?? "audio/mpeg", format === "opus" ? "ogg" : format, { durationMs });
    await finishJob(job, "succeeded", {});
    return;
  }
  throw new ProviderError("rejected", "نوع غير مدعوم.", `sync output ${def.output}`);
}

/**
 * ElevenLabs: Eleven v4 speech, a sound effect, or a song (with an optional reference recording), saved as MP3; or
 * «الفصل الذكي»: a video's dialogue, music and effects as separate tracks of the video's length.
 */
async function runEleven(job: JobRow, def: GeneratorDef, refs: UploadRow[]) {
  const s = job.inputs.settings;
  // (jobs made before «الفصل الذكي» were effects only, in the sound effects generator)
  if (def.id === SMART_SPLIT_ID || job.mode === "video_to_sfx") {
    const stems: Stem[] = job.mode === "video_to_sfx" ? ["sfx"] : stemsOf(s);
    const r = await makeSmartSplit(job, stems, refs.find((x) => x.kind === "video"), Number(s.influence) || 0.3);
    await db().from("jawad_jobs").update({ status: "saving", lease_until: later(LEASE_MS) }).eq("id", job.id);
    for (const [i, f] of r.files.entries()) await saveOutput(job, i, f.audio, f.mime, f.ext, { durationMs: f.durationMs }, f.stem);
    await finishJob(job, "succeeded", { costUsd: r.costUsd, units: r.units });
    return;
  }
  let audio: Buffer;
  let costUsd: number;
  let units: Record<string, unknown> = {};
  if (def.model.id === "eleven_v4") {
    const voice = await resolveVoice(job.user_id, String(s.voice));
    if (!voice.ok) throw new ProviderError("rejected", voice.reason, `voice ${String(s.voice)}`);
    // «النطق الدقيق»: the Arabic words whose sound depends on their vowels, written so the voice says them right
    const diction = dictionOf({ settings: s, prompt: job.prompt });
    if (diction !== "off") await db().from("jawad_jobs").update({ provider_status: "diction" }).eq("id", job.id);
    const spoken = await prepareSpeech(job.prompt, diction).catch((e) => {
      throw new ProviderError("rejected", "تعذّر تدقيق النطق الآن. لم يُخصم منك شيء؛ جرّب مرة ثانية أو اختر «كما كتبت».", `diction: ${String(e instanceof Error ? e.message : e).slice(0, 300)}`);
    });
    if (spoken.fixes.length) job.inputs = { ...job.inputs, modelPrompt: spoken.text, diction: { mode: diction, words: spoken.fixes.map((f) => ({ word: f.word, vocalized: f.vocalized })) } };
    if (diction !== "off") await db().from("jawad_jobs").update({ inputs: job.inputs, provider_status: "generating" }).eq("id", job.id);
    audio = await elevenSpeech({ voiceId: voice.voiceId, text: spoken.text, model: def.model.id, stability: Number(s.stability), languageCode: spoken.languageCode });
    costUsd = (spoken.text.length / 1000) * ELEVEN_PRICE.v4PerKChars + spoken.usd;
    units = { characters: spoken.text.length, ...(diction !== "off" ? { diction, fixed: spoken.fixes.length, claudeUsd: Number(spoken.usd.toFixed(4)) } : {}), ...(spoken.languageCode ? { languageCode: spoken.languageCode } : {}) };
  } else if (def.model.id === "eleven_text_to_sound_v2") {
    const seconds = Number(s.duration) || 5;
    audio = await elevenSoundEffect({ text: job.prompt, seconds, loop: Boolean(s.loop), influence: Number(s.influence) || 0.3 });
    costUsd = (seconds * ELEVEN_PRICE.sfxPerMin) / 60;
    units = { seconds };
  } else {
    const seconds = Number(s.duration) || 60;
    const ref = refs.find((r) => r.kind === "audio");
    if (ref) {
      const refMs = Math.min(ref.duration_ms ?? MUSIC_REF_MS, MUSIC_REF_MS);
      const use = MUSIC_REF_USE[String(s.refUse)] ?? MUSIC_REF_USE.inspire;
      await db().from("jawad_jobs").update({ provider_status: "uploading reference" }).eq("id", job.id);
      const r = await elevenMusicWithReference({ prompt: job.prompt, lengthMs: seconds * 1000, instrumental: Boolean(s.instrumental), model: def.model.id, reference: await download(ref.storage_path), mime: ref.mime ?? "audio/mpeg", refMs, strength: use.strength });
      audio = r.audio;
      costUsd = ((seconds + (ref.duration_ms ?? 0) / 1000) * ELEVEN_PRICE.musicPerMin) / 60;
      units = { seconds, referenceMs: ref.duration_ms, strength: use.strength, songId: r.songId };
    } else {
      const r = await elevenMusic({ prompt: job.prompt, lengthMs: seconds * 1000, instrumental: Boolean(s.instrumental), model: def.model.id });
      audio = r.audio;
      costUsd = (seconds * ELEVEN_PRICE.musicPerMin) / 60;
      units = { seconds, songId: r.songId };
    }
  }
  await db().from("jawad_jobs").update({ status: "saving", lease_until: later(LEASE_MS) }).eq("id", job.id);
  const bytes = new Uint8Array(audio);
  const sn = sniff(bytes);
  const durationMs = sn ? probe(bytes, sn).durationMs : undefined;
  await saveOutput(job, 0, audio, "audio/mpeg", "mp3", { durationMs });
  await finishJob(job, "succeeded", { costUsd, units });
}

// ───────────────────────────── video (ModelArk) ─────────────────────────────

/** Callback links carry a per-job signature so random calls are ignored (the payload itself is never trusted). */
function hookSecret() {
  return process.env.JAWAD_WEBHOOK_SECRET || createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").update("jawad-webhook").digest("hex");
}
export const hookToken = (jobId: string) => createHmac("sha256", hookSecret()).update(jobId).digest("hex").slice(0, 40);
export function hookTokenValid(jobId: string, token: string) {
  const a = Buffer.from(hookToken(jobId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function submitVideo(job: JobRow, def: GeneratorDef, refs: UploadRow[]) {
  const s = job.inputs.settings;
  const paths = refs.map((r) => r.storage_path);
  // ModelArk fetches the files itself: short-lived links to our private copies
  const signed = paths.length ? (await storage.from(JAWAD_BUCKET).createSignedUrls(paths, 3 * 3600)).data ?? [] : [];
  const text = job.inputs.modelPrompt ?? job.prompt;
  const content: ArkContent[] = text.trim() ? [{ type: "text", text }] : [];
  refs.forEach((r, i) => {
    const url = signed[i]?.signedUrl;
    if (!url) throw new ProviderError("rejected", "تعذّر تجهيز أحد المراجع.", `no signed url for ${r.storage_path}`);
    const role = job.refs[i]?.role;
    if (r.kind === "image") content.push({ type: "image_url", image_url: { url }, role: role === "first_frame" || role === "last_frame" ? role : "reference_image" });
    else if (r.kind === "video") content.push({ type: "video_url", video_url: { url }, role: "reference_video" });
    else content.push({ type: "audio_url", audio_url: { url }, role: "reference_audio" });
  });
  const origin = job.inputs.origin;
  const callback = origin?.startsWith("https://") ? `${origin}/api/jawad/webhooks/modelark?job=${job.id}&t=${hookToken(job.id)}` : undefined;

  const taskId = await arkCreateTask({
    model: def.model.id,
    content,
    ratio: String(s.ratio),
    resolution: String(s.resolution),
    duration: Number(s.duration),
    generate_audio: Boolean(s.audio),
    ...(callback ? { callback_url: callback } : {}),
    safety_identifier: providerUserId(job.user_id),
  });
  await db()
    .from("jawad_jobs")
    .update({ provider_task_id: taskId, submit_state: "accepted", status: "running", provider_status: "queued", lease_until: null })
    .eq("id", job.id);
  await event(job.id, "submitted", { task: taskId });

  // Short videos often finish within a few minutes: keep watching while this request is alive
  const until = Date.now() + WATCH_MS;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 10_000));
    const fresh = await loadJob(job.id);
    if (!fresh || !OPEN.includes(fresh.status)) return;
    await advanceJob(fresh, { force: true });
  }
}

export async function loadJob(id: string) {
  const { data } = await db().from("jawad_jobs").select("*").eq("id", id).maybeSingle();
  return (data as JobRow) ?? null;
}

const TASK_END_MESSAGE: Record<string, string> = {
  failed: "فشل التوليد لدى المزوّد. لم يُخصم منك شيء؛ عدّل الطلب وجرّب.",
  expired: "انتهت مهلة المهمة لدى المزوّد قبل أن تبدأ. لم يُخصم منك شيء.",
  cancelled: "أُلغيت المهمة. لم يُخصم منك شيء.",
};

/** Copies a finished video to our storage (the provider's link lasts 24 h) and ends the job. One worker at a time. */
async function saveVideo(job: JobRow, task: ArkTask) {
  // Taken by one worker only: a running job, or a save whose worker died (lease over). Plain filters on purpose:
  // PostgREST re-applies an or(...) filter to the returned rows, which would hide the row we just claimed.
  const claim = { status: "saving", lease_until: later(LEASE_MS), provider_status: "succeeded" };
  const first = await db().from("jawad_jobs").update(claim).eq("id", job.id).eq("status", "running").select("*");
  const retry = first.data?.length ? null : await db().from("jawad_jobs").update(claim).eq("id", job.id).eq("status", "saving").lt("lease_until", now()).select("*");
  const claimed = (first.data?.[0] ?? retry?.data?.[0] ?? null) as JobRow | null;
  if (!claimed) return;
  try {
    if (!task.videoUrl) throw new Error("succeeded without video_url");
    const res = await fetch(task.videoUrl, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) throw new Error(`video download ${res.status}`);
    const file = Buffer.from(await res.arrayBuffer());
    const bytes = new Uint8Array(file);
    const sn = sniff(bytes);
    const dims = sn?.kind === "video" ? probe(bytes, sn) : {};
    const mime = sn?.kind === "video" ? sn.mime : "video/mp4";
    await saveOutput(claimed, 0, file, mime, mime === "video/quicktime" ? "mov" : "mp4", dims);
    // The real cost from the provider's token count (rate of the resolution, with or without video input)
    const usd = task.tokens != null ? (task.tokens * videoRate(job)) / 1e6 : null;
    await finishJob(claimed, "succeeded", { costUsd: usd, units: { tokens: task.tokens, duration: task.duration, ratio: task.ratio, resolution: task.resolution } });
  } catch (e) {
    const attempts = (claimed.inputs.saveAttempts ?? 0) + 1;
    console.error("jawad video save failed", job.id, e);
    await event(job.id, "save_failed", { attempt: attempts, error: String(e instanceof Error ? e.message : e).slice(0, 300) });
    if (attempts >= MAX_SAVE_ATTEMPTS) {
      await finishJob(claimed, "failed", { message: "اكتمل الفيديو لكن تعذّر حفظه. لم يُخصم منك شيء.", detail: String(e instanceof Error ? e.message : e) });
    } else {
      // Back to "running": the next check reads the task again and retries the copy
      await db().from("jawad_jobs").update({ status: "running", lease_until: null, inputs: { ...claimed.inputs, saveAttempts: attempts } }).eq("id", job.id);
    }
  }
}

/** USD per 1M tokens of the job's model and resolution, from ModelArk's price page: a video in the input bills the whole task at the "with video" rate. */
function videoRate(job: JobRow) {
  const res = String(job.inputs.settings.resolution);
  const withVideo = job.refs.some((r) => r.kind === "video");
  const rates: Record<string, Record<string, [number, number]>> = {
    "dreamina-seedance-2-5-260628": { "480p": [10.7, 6.4], "720p": [10.7, 6.4], "1080p": [11.7, 7.0] },
    "dreamina-seedance-2-0-260128": { "480p": [7, 4.3], "720p": [7, 4.3], "1080p": [7.7, 4.7], "4k": [4, 2.4] },
  };
  return rates[job.model_id]?.[res]?.[withVideo ? 1 : 0] ?? 0;
}

/** A task we sent but never got an answer for: find it among the account's recent tasks (never send a second one). */
async function reconcileUnknown(job: JobRow) {
  const sent = new Date(job.submitted_at ?? job.created_at).getTime();
  const tasks = await arkListTasks(job.model_id).catch(() => null);
  const mine = providerUserId(job.user_id);
  const candidates = (tasks ?? [])
    .filter((t) => t.safetyIdentifier === mine && t.createdAt != null && t.createdAt * 1000 >= sent - 30_000 && t.createdAt * 1000 <= sent + 180_000)
    .sort((a, b) => Math.abs(a.createdAt! * 1000 - sent) - Math.abs(b.createdAt! * 1000 - sent));
  for (const t of candidates) {
    // The unique index stops one task from being claimed by two jobs
    const { error } = await db()
      .from("jawad_jobs")
      .update({ provider_task_id: t.id, submit_state: "accepted", status: "running", provider_status: t.status })
      .eq("id", job.id)
      .is("provider_task_id", null);
    if (!error) {
      await event(job.id, "reconciled", { task: t.id });
      return;
    }
  }
  if (tasks && Date.now() - sent > UNKNOWN_GIVE_UP_MS) {
    await finishJob(job, "failed", { message: "لم يتأكد وصول الطلب إلى المزوّد، ولم يُخصم منك شيء. جرّب مرة ثانية.", detail: "submission unknown; no matching task found" });
  }
}

/**
 * Moves an unfinished job forward from what is really true now. Safe to call often and from anywhere
 * (polling, the provider's callback, the daily sweep): every step is guarded so it happens once.
 */
export async function advanceJob(job: JobRow, o: { force?: boolean } = {}) {
  if (!OPEN.includes(job.status)) return;
  const age = Date.now() - new Date(job.created_at).getTime();
  const leaseOver = !job.lease_until || new Date(job.lease_until).getTime() < Date.now();
  const def = generatorById(job.generator_id);

  if (job.status === "queued") {
    // The request that created it died before sending: start it now (the claim makes this happen once)
    if (age > 60_000) after(() => runJob(job.id));
    return;
  }
  if (job.status === "submitting") {
    if (job.submit_state === "sending" && leaseOver) {
      if (def?.api.tracking === "async") {
        await db().from("jawad_jobs").update({ submit_state: "unknown" }).eq("id", job.id).eq("submit_state", "sending");
        return reconcileUnknown({ ...job, submit_state: "unknown" });
      }
      await finishJob(job, "failed", { message: "انقطع التوليد قبل أن يكتمل. لم يُخصم منك شيء.", detail: "worker lost while sending" });
      return;
    }
    if (job.submit_state === "unknown") return reconcileUnknown(job);
    return;
  }
  if (def?.api.tracking !== "async") {
    // Sync providers finish inside their own request; a lost worker means the result is gone
    if (leaseOver && Date.now() - new Date(job.updated_at).getTime() > LEASE_MS) {
      await finishJob(job, "failed", { message: "انقطع التوليد قبل حفظ النتيجة. لم يُخصم منك شيء.", detail: "worker lost while running/saving" });
    }
    return;
  }

  // ModelArk: read the real task state (at most every few seconds per job unless forced)
  if (!job.provider_task_id) return;
  if (job.status === "saving" && !leaseOver) return;
  if (!o.force && Date.now() - new Date(job.updated_at).getTime() < 6000) return;
  const task = await arkGetTask(job.provider_task_id).catch((e) => {
    console.error("jawad task check failed", job.id, e);
    return null;
  });
  const sent = new Date(job.submitted_at ?? job.created_at).getTime();
  if (!task) {
    if (Date.now() - sent > VIDEO_STALE_MS) await finishJob(job, "failed", { message: "انتهى وقت التوليد. لم يُخصم منك شيء.", detail: "stale; task unreadable" });
    return;
  }
  if (task.status === "succeeded") return saveVideo(job, task);
  if (task.status === "failed" || task.status === "expired" || task.status === "cancelled") {
    await finishJob(job, task.status === "cancelled" ? "cancelled" : "failed", { message: TASK_END_MESSAGE[task.status], detail: task.error ?? task.status });
    return;
  }
  if (Date.now() - sent > VIDEO_STALE_MS) {
    await arkCancelTask(task.id).catch(() => null);
    await finishJob(job, "failed", { message: "انتهى وقت التوليد. لم يُخصم منك شيء.", detail: `stale in ${task.status}` });
    return;
  }
  if (task.status !== job.provider_status || o.force) {
    await db().from("jawad_jobs").update({ provider_status: task.status }).eq("id", job.id).in("status", ["running"]);
  }
}

/** Cancels a video still waiting in the provider's queue (ModelArk cannot stop a running one). */
export async function cancelJob(userId: string, jobId: string) {
  const job = await loadJob(jobId);
  if (!job || job.user_id !== userId) throw new UserError("ما لقينا هذا التوليد.", 404);
  const def = generatorById(job.generator_id);
  if (def?.api.cancel !== "queued-only" || job.status !== "running" || !job.provider_task_id) {
    throw new UserError("لا يمكن إلغاء هذا التوليد الآن.", 409);
  }
  const task = await arkGetTask(job.provider_task_id);
  if (task.status !== "queued") throw new UserError("بدأ التوليد فعلًا، ولا يسمح المزوّد بإيقافه.", 409);
  await arkCancelTask(job.provider_task_id);
  await finishJob(job, "cancelled", { message: "ألغيت التوليد. أُعيد لك رصيده.", detail: "cancelled by user while queued" });
}

/** Moves the given user's (or everyone's) unfinished jobs forward. */
export async function advanceOpenJobs(userId?: string, limit = 25) {
  let q = db().from("jawad_jobs").select("*").in("status", OPEN).order("created_at", { ascending: true }).limit(limit);
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  for (const j of (data ?? []) as JobRow[]) await advanceJob(j).catch((e) => console.error("jawad advance failed", j.id, e));
}
