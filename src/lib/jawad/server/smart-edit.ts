// «الجواد الذكي!» | JAWAD AI — «التعديل الذكي» of a finished video or image. Server only.
//
//   quote ─► the price of the edit: the generation (same generator and settings) + the edit lines of the price table
//            (video: Claude writing the prompt + a fixed fee; image: a fixed fee).
//   click ─► everything is checked again; frames of the original video are stored; ONE database call creates the job
//            and takes its coins (or refuses). The job carries `inputs.edit` and an empty prompt.
//   run   ─► runJob calls prepareEdit first: Claude writes the corrected prompt (the Super Director for videos), then
//            the job is sent like any other. If Claude fails, the job fails and every coin comes back.

import { tellSajjad } from "@/lib/film/sajjad";
import { after } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn, type ClaudeUsage } from "@/lib/film/anthropic";
import { coinsOf, EDIT_CLAUDE_KEY, EDIT_CLAUDE_USD, EDIT_FEE_KEY, generatorById } from "@config/jawad/generators";
import { MAX_ACTIVE_JOBS } from "@config/jawad/brand";
import type { GeneratorDef, RefMeta, RefRole, RefStyle, Settings } from "@config/jawad/types";
import { evaluate, priceVersion } from "../engine";
import { defaultRefName, findMentions, promptForModel, sameName } from "../mentions";
import { CONTINUITY, continuityRanges, cutRange, EDIT_LIMITS, IMAGE_EDIT_MODES, readContinuity, VIDEO_EDIT_MODES, type ContinuityRange, type EditMode, type EditRange } from "../smart-edit";
import { directorRun, EDIT_TASK, settingsText } from "./director";
import { loadRuntime, JAWAD_BUCKET } from "./runtime";
import { isUuid, refsFor, uploadFromBuffer, uploadFromOutput } from "./uploads";
import { runJob, type JobRow } from "./jobs";
import { ProviderError } from "./providers/common";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();

/** What an edit job keeps until Claude has written its prompt. */
export interface EditInputs {
  sourceJobId: string;
  outputId: string;
  mode: EditMode;
  notes: string;
  ranges: EditRange[];
  cut: { start: number; end: number; seconds: number } | null;
  /** «الأجزاء»: the seconds of the video sent as continuity references (named before/after…), in order. */
  continuity?: ContinuityRange[];
  /** Frames of the original video (stored copies), with their time in seconds. */
  frames: { t: number; path: string }[];
  /** Set once the corrected prompt is written. */
  done?: boolean;
  claudeUsd?: number;
}

export interface EditBody {
  idempotencyKey?: unknown;
  jobId?: unknown;
  outputId?: unknown;
  mode?: unknown;
  notes?: unknown;
  ranges?: unknown;
  /** Video: small JPEG frames for Claude, `{ t, data: "data:image/jpeg;base64,…" }`. */
  frames?: unknown;
  /** Video, «الأجزاء»: the sound in the seconds right before and after the cut (short WAVs), so the sound carries on. */
  cutSounds?: unknown;
  /** Video, «الأجزاء»: the seconds of the video kept as continuity references (the editor's yellow track); default: around the cut. */
  continuity?: unknown;
  /** …and their uploads (cut in the browser), in the same order, when the edit is made. */
  continuityUploads?: unknown;
  expectedCoins?: unknown;
  /** The generator to make the edit with (another one of the same kind may be picked; default: the original's). */
  generatorId?: unknown;
  /** Only the price, nothing is made. */
  quote?: unknown;
}

export type EditResult =
  | { kind: "quote"; coins: number; lines: { label: string; centi: number }[]; cut: EditInputs["cut"] }
  | { kind: "issues"; issues: { field: string; message: string }[] }
  | { kind: "price_changed"; coins: number; lines: { label: string; centi: number }[] }
  | { kind: "created" | "existing"; job: JobRow; balance: number | null };

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max) : "");
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);

/** A frame sent by the browser: a real JPEG of a sensible size (it only ever reaches this user's own edit). */
export async function readFrame(data: unknown, maxBytes: number, maxSide: number) {
  if (typeof data !== "string") throw new UserError("لقطة غير صالحة.", 400);
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!m) throw new UserError("لقطة غير صالحة.", 400);
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length > maxBytes) throw new UserError("اللقطة كبيرة جدًا.", 400);
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (meta?.format !== "jpeg" || !meta.width || !meta.height || Math.max(meta.width, meta.height) > maxSide) throw new UserError("لقطة غير صالحة.", 400);
  return bytes;
}

/** Seedance 2.0 takes 9 pictures and 3 videos at most. */
const PART_REFS_MAX = 12;
const contName = (r: ContinuityRange, i: number, all: ContinuityRange[]) => {
  const same = all.filter((x) => x.at === r.at);
  return same.length > 1 ? `${r.at}${same.indexOf(r) + 1}` : r.at;
};

/** A short WAV of the sound around a cut, sent by the page (or null: none, or not a WAV of a sensible size). */
function readSound(data: unknown): Buffer | null {
  if (typeof data !== "string") return null;
  const m = /^data:audio\/wav;base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!m) return null;
  const bytes = Buffer.from(m[1], "base64");
  return bytes.length > 44 && bytes.length <= 1_500_000 && bytes.toString("ascii", 0, 4) === "RIFF" ? bytes : null;
}

/** The price lines of the edit itself (on top of the generation). Null when the owner switched one off. */
function editLines(def: GeneratorDef, table: Record<string, number | null>) {
  const video = def.output === "video";
  const keys = video ? [EDIT_CLAUDE_KEY, EDIT_FEE_KEY] : [EDIT_FEE_KEY];
  const labels: Record<string, string> = { [EDIT_CLAUDE_KEY]: "Claude يكتب البرومبت المعدّل", [EDIT_FEE_KEY]: "التعديل الذكي" };
  const lines = keys.map((k) => ({ label: labels[k], centi: table[k] }));
  return lines.every((l) => l.centi != null) ? (lines as { label: string; centi: number }[]) : null;
}

export async function smartEdit(user: { id: string }, owner: boolean, b: EditBody, origin: string): Promise<EditResult> {
  const quote = b.quote === true;
  const key = String(b.idempotencyKey ?? "");
  if (!quote && !/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  if (!quote) {
    const existing = await db().from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle();
    if (existing.data) return { kind: "existing", job: existing.data as JobRow, balance: null };
  }

  // The original: one of my finished jobs, and one of its results
  if (!isUuid(b.jobId) || !isUuid(b.outputId)) throw new UserError("طلب غير صحيح.", 400);
  const { data: src } = await db().from("jawad_jobs").select("*").eq("id", b.jobId).eq("user_id", user.id).maybeSingle();
  const source = src as JobRow | null;
  if (!source || source.status !== "succeeded") throw new UserError("ما لقينا هذا العمل.", 404);
  const { data: out } = await db().from("jawad_outputs").select("*").eq("id", b.outputId).eq("job_id", source.id).maybeSingle();
  if (!out) throw new UserError("ما لقينا هذا العمل.", 404);
  const original = generatorById(source.generator_id);
  if (!original || (original.output !== "video" && original.output !== "image")) throw new UserError("التعديل الذكي متاح للفيديو والصور فقط.", 400);
  // The student may switch to another generator of the same kind before making the edit
  const picked = typeof b.generatorId === "string" && b.generatorId ? generatorById(b.generatorId) : original;
  if (!picked || picked.output !== original.output) throw new UserError("اختر مولدًا من نفس النوع.", 400);
  const def = picked;
  const switched = def.id !== original.id;

  const rt = await loadRuntime();
  if (!rt.migrated) throw new UserError("منصة JAWAD AI قيد التجهيز (قاعدة البيانات).", 503);
  const rg = rt.generators.find((g) => g.id === def.id)!;
  if (!(rg.live || (owner && rg.keyConfigured))) throw new UserError("هذا المولد غير متاح حاليًا.", 403);
  const section = rt.sections.find((s) => s.id === source.section_id && (s.enabled || owner));
  if (!section) throw new UserError("هذا القسم غير متاح حاليًا.", 403);
  const table = rt.prices[def.id];
  const extra = editLines(def, table);
  if (!extra) throw new UserError(switched ? `التعديل الذكي غير متاح على ${def.name}.` : "التعديل الذكي غير متاح حاليًا.", 403);

  // What to change
  const mode = b.mode as EditMode;
  if (!(def.output === "video" ? VIDEO_EDIT_MODES : IMAGE_EDIT_MODES).includes(mode)) throw new UserError("اختر نوع التعديل.", 400);
  const notes = clean(b.notes, EDIT_LIMITS.notesMax);
  const videoSec = (Number(out.duration_ms) || Number(source.inputs.settings.duration) * 1000) / 1000;
  const rawRanges = Array.isArray(b.ranges) ? b.ranges.slice(0, EDIT_LIMITS.rangesMax + 1) : [];
  const ranges: EditRange[] = rawRanges.map((r) => {
    const x = (r ?? {}) as Record<string, unknown>;
    return { from: num(x.from), to: num(x.to), note: clean(x.note, EDIT_LIMITS.noteMax) };
  });
  if (def.output !== "video" && ranges.length) throw new UserError("طلب غير صحيح.", 400);
  if (ranges.length > EDIT_LIMITS.rangesMax) throw new UserError(`حدّد ${EDIT_LIMITS.rangesMax} أجزاء على الأكثر.`, 400);
  for (const r of ranges) {
    if (!(r.from >= 0 && r.to > r.from && r.to <= videoSec + 0.05)) throw new UserError(`كل جزء يبدأ قبل نهايته وداخل مدة المقطع (${videoSec.toFixed(1)} ث).`, 400);
  }
  if (!quote && notes.length < 3 && !ranges.some((r) => r.note.length >= 3)) throw new UserError("اكتب الأخطاء والتعديل المطلوب.", 400);

  const durationOpt = def.options.find((o) => o.key === "duration" && o.kind === "int") as { min?: number; max?: number } | undefined;
  let cut: EditInputs["cut"] = null;
  if (mode === "parts") {
    if (ranges.length !== 1) throw new UserError("حدّد الجزء الذي لم ينجح (من ثانية إلى ثانية).", 400);
    cut = cutRange(ranges[0].from, ranges[0].to, videoSec, durationOpt?.min ?? 4, durationOpt?.max ?? 15);
    if (!cut) throw new UserError(`المقطع أقصر من أقل مدة يولّدها ${def.name}؛ اختر «أعد المقطع كاملًا».`, 400);
  }
  // the seconds kept for continuity: the yellow track's (from the editor), or around the cut
  const sent = mode === "parts" && b.continuity !== undefined ? readContinuity(b.continuity, videoSec) : null;
  if (mode === "parts" && b.continuity !== undefined && !sent) throw new UserError("مقاطع الاستمرارية (الأصفر): كل واحد ثانيتين أو أكثر، ٣ على الأكثر، ومجموعها ١٥ ث.", 400);
  const cont: ContinuityRange[] = mode === "parts" ? (sent ?? continuityRanges(cut!, videoSec)) : [];

  // The new job: same generator and settings; its references depend on the kind of edit
  const settings: Settings = { ...(source.inputs.settings ?? {}) };
  let refStyle: RefStyle = source.inputs.refStyle ?? "none";
  let meta: (RefMeta & { name: string })[] = [];
  const named = (m: RefMeta[], names: (string | undefined)[]) => {
    const given = names.filter((n): n is string => Boolean(n));
    return m.map((x, i) => {
      const name = names[i] ?? defaultRefName(x.kind, given);
      if (!names[i]) given.push(name);
      return { ...x, name };
    });
  };
  const sourceRefs = async () => {
    const found = await refsFor(user.id, source.refs.map((r) => ({ uploadId: r.uploadId, role: r.role }))).catch(() => {
      throw new UserError("أحد مراجع العمل الأصلي حُذف، فلا يمكن إعادته بنفس المراجع.", 400);
    });
    return named(found.meta, source.refs.map((r) => r.name));
  };
  const outMeta = (role: RefRole, name: string, id = String(out.id)): RefMeta & { name: string } => ({
    id, kind: "image", role, mime: "image/jpeg", bytes: 1, width: out.width, height: out.height, status: "ready", name,
  });

  if (mode === "whole" || mode === "full") {
    meta = await sourceRefs();
  } else if (mode === "parts") {
    // The new piece carries on the video itself: seconds of it right before (and after) the cut go as video
    // references — motion, camera, light and sound — with the original's own references. No still frames.
    refStyle = "references";
    settings.duration = cut!.seconds;
    const own = await sourceRefs();
    // Priced with the pieces' lengths; the real pieces are checked before the job is made
    meta = [
      ...cont.map((r, i): RefMeta & { name: string } => ({ id: randomUUID(), kind: "video", role: "reference", mime: "video/mp4", bytes: 1, width: out.width, height: out.height, durationMs: Math.round((r.to - r.from) * 1000), fps: 24, status: "ready", name: contName(r, i, cont) })),
      ...own,
    ].slice(0, PART_REFS_MAX);
  } else {
    refStyle = "references";
    meta = [outMeta("reference", "result")];
  }
  if (def.output === "image") settings.count = 1;

  // The price: the generation (an image prompt at its cap; a video's price does not depend on the prompt) + the edit
  const placeholder = def.output === "image" ? "x".repeat(EDIT_LIMITS.imagePromptBytes) : "x";
  const price = (m: RefMeta[]) => {
    // Another generator: the original's settings are carried over where they fit, the rest take that generator's defaults
    const e = evaluate(def, { settings, prompt: placeholder, instructions: "", refStyle, refs: m, strict: !switched }, table);
    if (e.issues.length) return { e, issues: e.issues };
    if (!e.price.ok) return { e, issues: [{ field: "price", message: e.price.reason }] };
    const lines = [...e.price.lines, ...extra];
    return { e, lines, coins: coinsOf(lines.reduce((s, l) => s + l.centi, 0)), usd: (e.price.usdCeiling ?? 0) + (def.output === "video" ? EDIT_CLAUDE_USD : 0) };
  };
  const first = price(meta);
  if (first.issues) return { kind: "issues", issues: first.issues };
  if (quote) return { kind: "quote", coins: first.coins!, lines: first.lines!, cut };
  if (Number(b.expectedCoins) !== first.coins) return { kind: "price_changed", coins: first.coins!, lines: first.lines! };
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("التعديل الذكي غير متاح حاليًا.", 503);

  // Frames of the original video for Claude, stored with the edit
  const editId = randomUUID();
  const frames: EditInputs["frames"] = [];
  if (def.output === "video") {
    const raw = Array.isArray(b.frames) ? b.frames.slice(0, EDIT_LIMITS.framesMax + 1) : [];
    if (!raw.length || raw.length > EDIT_LIMITS.framesMax) throw new UserError("تعذّر تجهيز لقطات المقطع؛ جرّب مرة ثانية.", 400);
    for (const [i, f] of raw.entries()) {
      const x = (f ?? {}) as { t?: unknown; data?: unknown };
      const t = num(x.t);
      if (!(t >= 0 && t <= videoSec + 0.1)) throw new UserError("لقطة غير صالحة.", 400);
      const bytes = await readFrame(x.data, 400_000, 1280);
      const path = `${user.id}/edits/${editId}/f${i}.jpg`;
      const up = await storage.from(JAWAD_BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
      if (up.error) throw new Error(`حفظ لقطات الفيديو: ${up.error.message}`);
      frames.push({ t: Math.round(t * 10) / 10, path });
    }
  }
  // «الأجزاء»: the frames at both cuts become the new clip's first and last frames (checked like any upload)
  if (mode === "parts") {
    // the continuity pieces, cut in the browser and uploaded: each one a video of this user, about as long as asked
    const ids = Array.isArray(b.continuityUploads) ? b.continuityUploads.slice(0, CONTINUITY.max + 1) : [];
    if (ids.length !== cont.length || !ids.every(isUuid)) throw new UserError("تعذّر تجهيز مقاطع الاستمرارية؛ جرّب مرة ثانية.", 400);
    const own = meta.slice(cont.length);
    const found = cont.length ? await refsFor(user.id, ids.map((id) => ({ uploadId: id as string, role: "reference" as RefRole }))) : { meta: [] };
    found.meta.forEach((m, i) => {
      const want = (cont[i].to - cont[i].from) * 1000;
      if (m.kind !== "video" || Math.abs((m.durationMs ?? 0) - want) > 1500) throw new UserError("أحد مقاطع الاستمرارية ما وصل صح؛ جرّب مرة ثانية.", 400);
    });
    meta = [...named(found.meta, cont.map((r, i) => contName(r, i, cont))), ...own].slice(0, PART_REFS_MAX);
    // the sound right before and after the cut, so voices, effects and music carry on (when the clip has sound)
    if (settings.audio !== false) {
      const snd = (b.cutSounds ?? {}) as { before?: unknown; after?: unknown };
      const sounds: { uploadId: string; role: RefRole }[] = [];
      const soundNames: string[] = [];
      for (const [data, name] of [[snd.before, "sound_before"], [snd.after, "sound_after"]] as const) {
        const bytes = readSound(data);
        if (!bytes) continue;
        const up = await uploadFromBuffer(user.id, new Uint8Array(bytes), `${name}.wav`).catch(() => null);
        if (up?.status === "ready") {
          sounds.push({ uploadId: up.id, role: "reference" });
          soundNames.push(name);
        }
      }
      if (sounds.length) meta = [...meta, ...named((await refsFor(user.id, sounds)).meta, soundNames)];
    }
  } else if (mode === "same") {
    const up = await uploadFromOutput(user.id, out.id);
    if (up.status !== "ready") throw new UserError(up.error ?? "تعذّر تجهيز الصورة.", 400);
    const found = await refsFor(user.id, [{ uploadId: up.id, role: "reference" }]);
    meta = named(found.meta, ["result"]);
  }
  const final = price(meta);
  if (final.issues) return { kind: "issues", issues: final.issues };
  if (final.coins !== first.coins) return { kind: "price_changed", coins: final.coins!, lines: final.lines! };

  const edit: EditInputs = { sourceJobId: source.id, outputId: String(out.id), mode, notes, ranges, cut, frames, ...(cont.length ? { continuity: cont } : {}) };
  const charge = !owner && final.coins! > 0;
  const { data, error } = await db().rpc("jawad_create_job", {
    p_job: {
      user_id: user.id,
      idempotency_key: key,
      section_id: section.id,
      generator_id: def.id,
      provider: def.provider.id,
      model_id: def.model.id,
      mode: final.e.mode.id,
      output_kind: def.output,
      prompt: "",
      // a film's clip stays tied to its film through every edit (so it can go back to it, and سجاد hears of it)
      inputs: { settings: final.e.settings, instructions: "", refStyle, origin, edit, ...(source.inputs.film ? { film: source.inputs.film } : {}) },
      refs: meta.map((m) => ({ uploadId: m.id, kind: m.kind, role: m.role, name: m.name })),
      price_coins: final.coins,
      price_breakdown: final.lines,
      pricing_version: priceVersion(table),
      cost_usd_estimate: final.usd,
    },
    p_charge: charge,
    p_max_active: MAX_ACTIVE_JOBS,
    p_label: `JAWAD AI · التعديل الذكي · ${def.name}`,
  });
  if (error) {
    const msg = String(error.message ?? "");
    if (msg.includes("JAWAD_INSUFFICIENT")) throw new UserError(`رصيدك من النقود الذكية لا يكفي: هذا التعديل يحتاج ${final.coins} نقدة.`, 402);
    if (msg.includes("JAWAD_BUSY")) throw new UserError(`عندك ${MAX_ACTIVE_JOBS} توليدات قيد العمل. انتظر حتى ينتهي أحدها.`, 429);
    throw new Error(`إنشاء العمل: ${msg}`);
  }
  const row = (data as { job_id: string; created: boolean; balance: number | null }[])[0];
  const { data: job } = await db().from("jawad_jobs").select("*").eq("id", row.job_id).single();
  if (row.created) after(() => runJob(row.job_id));
  const film = source.inputs.film;
  if (row.created && film?.projectId) {
    const asked = [notes, ...ranges.map((r) => `${r.from}–${r.to} ث: ${r.note}`)].filter(Boolean).join(" · ");
    after(() => tellSajjad(film.projectId, `بدأ «تعديل ذكي» على ${film.genId ?? "مقطع"} (${mode === "parts" ? "جزء منه" : "كامل"} من جديد، بنفس المراجع): ${asked || "—"}`));
  }
  return { kind: row.created ? "created" : "existing", job: job as JobRow, balance: row.balance };
}

// ───────────────────────────── the corrected prompt ─────────────────────────────

const IMAGE_SYSTEM = `You write prompts for OpenAI's GPT Image 2 inside the JAWAD AI image studio. You run in the background; the user never sees this exchange. Answer only with the JSON object {"prompt": "..."}.

The user made an image with the PREVIOUS PROMPT and settings given in the message; that result is attached as @result. They then wrote, precisely, what to change.

When the mode is SAME (edit the same image): the generator receives @result as its input image. Write an edit prompt that states exactly what to change (where in the image and how) and says clearly that everything else must stay exactly as it is: composition, framing, people and their faces, poses, hands, clothing, every piece of text, colors, lighting, style and image quality. Refer to the input image only as @result.

When the mode is FULL (make the image again): a FRESH GENERATION. The generator does NOT receive @result; it receives only the references listed in the message (if any). Write a complete, standalone prompt from the previous prompt's ideas with the user's change built in as simply how the image is. Write only what should be there, positively: never mention the previous image, a mistake, a fix or a change, and never describe the unwanted result, not even to forbid it (naming it brings it back). Refer to references only by their @name, exactly as given; never mention @result.

Rules:
- Write in English (the generator follows it best), except text that must appear in the image: keep it exactly in its language and spelling, inside double quotes.
- At most 1,500 characters. Concrete and visual; no explanations, no alternatives, no lists of options.
- Do not add anything the user did not ask for. Never invent a reference or a name.`;

const IMAGE_SCHEMA = { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"], additionalProperties: false };

async function signed(paths: string[]) {
  if (!paths.length) return [];
  const { data } = await storage.from(JAWAD_BUCKET).createSignedUrls(paths, 900);
  return paths.map((_, i) => data?.[i]?.signedUrl ?? null);
}

/** Problems of an image prompt written by Claude (the request is sent again with them once). */
function imagePromptProblems(prompt: string, names: string[], mode: EditMode) {
  const problems: string[] = [];
  if (!prompt.trim()) problems.push("The prompt is empty.");
  if (Buffer.byteLength(prompt) > EDIT_LIMITS.imagePromptBytes) problems.push(`The prompt is too long: keep it under 1,500 characters (${EDIT_LIMITS.imagePromptBytes} bytes at most).`);
  for (const m of findMentions(prompt)) {
    if (!names.some((n) => sameName(n, m.name))) problems.push(`@${m.name} is not a reference of this request; use only: ${names.map((n) => `@${n}`).join(", ") || "none"}.`);
  }
  if (mode === "same" && !findMentions(prompt).some((m) => sameName(m.name, "result"))) problems.push("Refer to the input image as @result.");
  return problems;
}

/** What the continuity videos are, for the prompt writer. */
function continuityText(edit: EditInputs) {
  const cont = edit.continuity ?? [];
  if (!cont.length) return "keep the original's framing, camera, positions, light and motion so both joins are invisible.";
  const lines = cont.map((r, i) => {
    const name = contName(r, i, cont);
    return r.at === "before"
      ? `@${name} is the original video itself from ${r.from.toFixed(1)} s to ${r.to.toFixed(1)} s, right BEFORE the cut: the new clip continues straight out of its last moment — identical framing, camera position and lens, the same people in the same places, the same light, every motion carrying on in the same direction at the same speed, and its sound (voices, effects, music) running on.`
      : `@${name} is the original video itself from ${r.from.toFixed(1)} s to ${r.to.toFixed(1)} s, right AFTER the cut: the new clip ends flowing into its first moment — same framing, positions, poses and sound.`;
  });
  return `${lines.join(" ")} These videos are references for continuity only: never copy, replay or include their content in the new clip — it is only the new part in between. Say this plainly at the start of the prompt.`;
}

/**
 * The generator's shortest clip is longer than what the person marked (e.g. 2 s marked, 4 s made): which seconds are
 * the change and which only carry the same moment on, so the whole clip is filled with the same idea.
 */
function partFill(edit: EditInputs) {
  const r = edit.ranges[0];
  if (!r || !edit.cut) return "";
  const marked = r.to - r.from;
  if (edit.cut.seconds - marked < 0.5) return "";
  const before = Math.max(0, r.from - edit.cut.start);
  const after = Math.max(0, edit.cut.end - r.to);
  return `\n\nTIMING — the generator's shortest clip is ${edit.cut.seconds} s, longer than the ${marked.toFixed(1)} s the user marked. Fill the whole ${edit.cut.seconds} s with ONE continuous moment of the same idea:
- 0.0–${before.toFixed(1)} s of the new clip (= ${edit.cut.start.toFixed(1)}–${r.from.toFixed(1)} s of the original): the same action, pace and camera as in the original at those seconds, flowing out of the first frame.
- ${before.toFixed(1)}–${(before + marked).toFixed(1)} s (= the marked ${r.from.toFixed(1)}–${r.to.toFixed(1)} s): the part the user wants different, written as simply how it happens.
- ${(before + marked).toFixed(1)}–${edit.cut.seconds.toFixed(1)} s (= ${r.to.toFixed(1)}–${edit.cut.end.toFixed(1)} s of the original, ${after.toFixed(1)} s): the same action carries on as in the original and lands exactly on the last frame.
Describe it as one natural, unhurried beat at the original's speed: no added events, no slow-motion or frozen padding, no new cuts.`;
}

/**
 * Before an edit job is sent: Claude writes the corrected prompt from the user's notes, the previous prompt and what
 * was really made. Videos use the Super Director with the editing task; images a focused prompt writer.
 */
export async function prepareEdit(job: JobRow): Promise<JobRow> {
  const edit = job.inputs.edit as EditInputs;
  const def = generatorById(job.generator_id)!;
  await db().from("jawad_jobs").update({ provider_status: "rewriting" }).eq("id", job.id);
  try {
    const { data: srcRow } = await db().from("jawad_jobs").select("*").eq("id", edit.sourceJobId).maybeSingle();
    const source = srcRow as JobRow | null;
    if (!source) throw new Error("source job missing");
    const { data: out } = await db().from("jawad_outputs").select("*").eq("id", edit.outputId).maybeSingle();
    const found = await refsFor(job.user_id, job.refs.map((r) => ({ uploadId: r.uploadId, role: r.role })));
    const meta = found.meta.map((m, i) => ({ ...m, name: job.refs[i].name ?? `${m.kind}${i + 1}` }));
    const names = meta.map((m) => m.name);
    const previous = source.inputs.modelPrompt && source.inputs.modelPrompt !== source.prompt ? `${source.prompt}\n\n(As the generator received it: ${source.inputs.modelPrompt})` : source.prompt;
    const asked = [
      edit.notes ? `What went wrong and what to change:\n<<<\n${edit.notes}\n>>>` : "",
      ...edit.ranges.map((r) => `- From ${r.from.toFixed(1)} s to ${r.to.toFixed(1)} s${r.note ? `: ${r.note}` : ""}`),
    ].filter(Boolean).join("\n");

    let prompt: string;
    let usd = 0;
    if (def.output === "video") {
      const s = job.inputs.settings;
      const task =
        edit.mode === "parts"
          ? `Mode: ONLY A PART is regenerated. The part from ${edit.cut!.start.toFixed(1)} s to ${edit.cut!.end.toFixed(1)} s of the original video is replaced by a new ${edit.cut!.seconds}-second clip, cut in so that nobody can see the joins.
CONTINUITY (the most important thing): ${continuityText(edit)}${names.some((n) => n.startsWith("sound_")) ? ` SOUND CONTINUITY: ${names.includes("sound_before") ? "@sound_before is the original's sound in the seconds right before the cut" : ""}${names.includes("sound_before") && names.includes("sound_after") ? " and " : ""}${names.includes("sound_after") ? "@sound_after the sound right after it" : ""}: the new clip's sound continues it seamlessly — the same voices (timbre, pitch, pace) with any line in progress finishing naturally, the same ambience and sound effects, and the same music (tempo, key, instruments, level) running straight through both joins, no new music or sudden silence.` : ""} The other references are the original's characters and places.${partFill(edit)}`
          : "Mode: the WHOLE clip is made again as a fresh generation, with the same settings and references (the old video is not sent to the generator).";
      const parts: ClaudePart[] = [
        { type: "text", text: settingsText(def, s, job.mode, meta) },
        { type: "text", text: `${task}\n\nPREVIOUS PROMPT (the ideas to keep; the old video was made with it):\n<<<\n${previous}\n>>>\n\nOriginal video: ${((Number(out?.duration_ms) || Number(source.inputs.settings.duration) * 1000) / 1000).toFixed(1)} s, settings ${JSON.stringify(source.inputs.settings)}.` },
      ];
      const frameUrls = await signed(edit.frames.map((f) => f.path));
      edit.frames.forEach((f, i) => {
        if (frameUrls[i]) parts.push({ type: "text", text: `Frame of the old video at ${f.t.toFixed(1)} s (for your understanding only):` }, { type: "image", url: frameUrls[i]! });
      });
      const refUrls = await signed(found.rows.filter((r) => r.kind === "image").slice(0, 8).map((r) => r.storage_path));
      found.rows.filter((r) => r.kind === "image").slice(0, 8).forEach((r, i) => {
        const m = meta[found.rows.indexOf(r)];
        if (refUrls[i]) parts.push({ type: "text", text: `@${m.name}:` }, { type: "image", url: refUrls[i]! });
      });
      parts.push({ type: "text", text: `What the user wants different (build it into the new prompt as simply how the shot is; never mention the old video or what was wrong):\n${asked}` });
      const r = await directorRun(EDIT_TASK, parts, names);
      prompt = r.prompt;
      usd = r.usd;
    } else {
      const [resultUrl] = await signed(out ? [out.storage_path] : []);
      const parts: ClaudePart[] = [
        {
          type: "text",
          text: [
            `Mode: ${edit.mode === "same" ? "SAME (edit the same image)" : "FULL (make the image again)"}`,
            `Settings: ${JSON.stringify(job.inputs.settings)}`,
            edit.mode === "full" ? (meta.length ? `References sent to the generator: ${names.map((n) => `@${n}`).join(", ")}` : "References sent to the generator: none.") : "",
            `PREVIOUS PROMPT:\n<<<\n${previous}\n>>>`,
          ].filter(Boolean).join("\n\n"),
        },
      ];
      if (resultUrl) parts.push({ type: "text", text: "@result (the image that was made):" }, { type: "image", url: resultUrl });
      if (edit.mode === "full") {
        const refUrls = await signed(found.rows.slice(0, 8).map((r) => r.storage_path));
        found.rows.slice(0, 8).forEach((_, i) => refUrls[i] && parts.push({ type: "text", text: `@${meta[i].name}:` }, { type: "image", url: refUrls[i]! }));
      }
      parts.push({ type: "text", text: `The user's requested changes:\n${asked}` });
      let turns: ClaudeTurn[] = [{ role: "user", content: parts }];
      const usage: ClaudeUsage[] = [];
      let written: string | null = null;
      for (let attempt = 1; attempt <= 2 && written === null; attempt++) {
        const r = await callClaudeJson<{ prompt: string }>({ system: IMAGE_SYSTEM, turns, schema: IMAGE_SCHEMA, maxTokens: 8000 });
        usage.push(r.usage);
        const problems = imagePromptProblems(r.data.prompt ?? "", names, edit.mode);
        if (!problems.length) written = r.data.prompt.trim();
        else turns = [...turns, { role: "assistant", content: r.raw }, { role: "user", content: `Fix these and return the complete JSON again:\n- ${problems.join("\n- ")}` }];
      }
      if (written === null) throw new Error("image prompt broke the rules twice");
      prompt = written;
      usd = usage.reduce((t, u) => t + claudeCost(u), 0);
    }

    const modelPrompt = def.refLabel ? promptForModel(prompt, meta, def.refLabel).text : prompt;
    const inputs = { ...job.inputs, ...(modelPrompt !== prompt ? { modelPrompt } : {}), edit: { ...edit, done: true, claudeUsd: Number(usd.toFixed(4)) } };
    const { data } = await db().from("jawad_jobs").update({ prompt, inputs, provider_status: null, lease_until: new Date(Date.now() + 7 * 60_000).toISOString() }).eq("id", job.id).select("*").single();
    console.info("jawad smart edit", { job: job.id, mode: edit.mode, usd: Number(usd.toFixed(4)) });
    return data as JobRow;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("rejected", "تعذّر كتابة البرومبت المعدّل الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.", `smart edit prompt: ${e instanceof Error ? e.message : String(e)}`);
  }
}
