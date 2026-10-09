// «الجواد الذكي!» | JAWAD AI — «التعديل الذكي» of a finished video or image. Server only.
//
//   quote ─► the price of the edit: the generation (same generator and settings) + the edit lines of the price table
//            (video: Claude writing the prompt + a fixed fee; image: a fixed fee).
//   click ─► everything is checked again; frames of the original video are stored; ONE database call creates the job
//            and takes its coins (or refuses). The job carries `inputs.edit` and an empty prompt.
//   run   ─► runJob calls prepareEdit first: جواد writes the final prompt — he gets the person's own words untouched and
//            the whole shot (previous prompt, frames, references, continuity, the film's brief) and decides — then the
//            job is sent like any other. If he fails, the job fails and every coin comes back.

import { coinStr } from "@config/coins";
import { sajjadBrief, tellSajjad } from "@/lib/film/sajjad";
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
import { KEPT_RULES, LOCKS_SCHEMA, locksForSajjad, missingLocks, missingText, readLocks, type EditLock } from "../edit-locks";
import { defaultRefName, findMentions, promptForModel, sameName } from "../mentions";
import { CONTINUITY, continuityRanges, cutRange, EDIT_LIMITS, IMAGE_EDIT_MODES, readContinuity, readEditSettings, VIDEO_EDIT_MODES, type ContinuityRange, type EditMode, type EditRange } from "../smart-edit";
import { directorRun, EDIT_TASK, settingsText } from "./director";
import { loadRuntime, JAWAD_BUCKET } from "./runtime";
import { isUuid, refsFor, uploadFromBuffer, uploadFromOutput } from "./uploads";
import { runJob, type JobRow } from "./jobs";
import { ProviderError } from "./providers/common";
import { CONTINUITY_METHOD, JAWAD_EDIT_IDENTITY, checkEditPrompt, editModelsBrief, personWordsText, shotRecordText, timingBlock, type EditModel } from "@config/jawad/smart-edit-training";

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
  /** The original's locks (what the new prompt had to keep), written before the prompt. */
  locks?: EditLock[];
  /** Set once the corrected prompt is written. */
  done?: boolean;
  /** Who decided the final prompt: جواد himself, from the person's own words and the whole shot. */
  writer?: "jawad";
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
  /** The generation options chosen again for this edit (resolution, sound, seconds of a whole clip…): checked by readEditSettings. */
  settings?: unknown;
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

/**
 * The size of a piece cut from the original video, as the generator's rules read it. A video that came from the film
 * maker has no stored size: the original's resolution and ratio give it (always inside the generator's own limits).
 */
function placeholderDims(out: { width?: number | null; height?: number | null }, source: JobRow): { width: number; height: number } {
  if (out.width && out.height) return { width: out.width, height: out.height };
  const s = source.inputs.settings ?? {};
  const short = { "480p": 480, "720p": 720, "1080p": 1080, "4k": 2160 }[String(s.resolution)] ?? 720;
  const [a, b] = String(s.ratio ?? "16:9").split(":").map(Number);
  const ratio = a > 0 && b > 0 ? a / b : 16 / 9;
  // the short side is the resolution; the long side follows the ratio (never below the generator's pixel floor)
  const long = Math.max(short, Math.round(short * Math.max(ratio, 1 / ratio)));
  return ratio >= 1 ? { width: long, height: short } : { width: short, height: long };
}

/**
 * Is the price the person agreed to the price charged? Those who make for free («بلا حدود»: the owners, the all-opening
 * code, the marked) pay nothing, so there is nothing for them to agree to.
 */
export const priceAgreed = (free: boolean, expected: unknown, coins: number) => free || Number(expected) === coins;

/**
 * The continuity videos as the price reads them: cut from this generator's own video, so its size and frame rate are
 * the generator's (whatever the browser's probe says), and its length is the length asked — the page's cut may land a
 * few frames long on a key frame, and a second more must never move the price between the quote, the click and the job.
 */
export function trustedContinuity(found: RefMeta[], cont: ContinuityRange[], dims: { width: number; height: number }): RefMeta[] {
  return found.map((m, i) => ({ ...m, ...dims, fps: 24, durationMs: Math.round((cont[i].to - cont[i].from) * 1000) }));
}

/** The price lines of the edit itself (on top of the generation). Null when the owner switched one off. */
function editLines(def: GeneratorDef, table: Record<string, number | null>) {
  const video = def.output === "video";
  const keys = video ? [EDIT_CLAUDE_KEY, EDIT_FEE_KEY] : [EDIT_FEE_KEY];
  const labels: Record<string, string> = { [EDIT_CLAUDE_KEY]: "جواد يكتب البرومبت المعدّل", [EDIT_FEE_KEY]: "التعديل الذكي" };
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
  // the original's settings, then what the person chose for this edit (resolution, sound, the whole clip's seconds…): the
  // same options the generation had, so the price is counted the same way; they go to جواد with the rest of the request
  const settings: Settings = { ...(source.inputs.settings ?? {}), ...readEditSettings(def, b.settings, mode) };
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
      ...cont.map((r, i): RefMeta & { name: string } => ({ id: randomUUID(), kind: "video", role: "reference", mime: "video/mp4", bytes: 1, ...placeholderDims(out, source), durationMs: Math.round((r.to - r.from) * 1000), fps: 24, status: "ready", name: contName(r, i, cont) })),
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
  // The price the person saw must be the price charged — checked here, FIRST, before any upload or Claude call, so a mismatch
  // fails at once. Those who make for free («بلا حدود»: the owners, the all-opening code, the marked) pay nothing, so there is nothing to confirm.
  if (!priceAgreed(owner, b.expectedCoins, first.coins!)) return { kind: "price_changed", coins: first.coins!, lines: first.lines! };
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
    // cut from this generator's own video: its size and frame rate are the generator's, whatever the browser's probe says; and
    // its length is the length asked (the check above allows 1.5 s of slack for the cut landing on a key frame), so the price
    // is the same at the quote, at the click and when the job is made — never a second more because a cut ran a few frames long
    const trusted = trustedContinuity(found.meta, cont, placeholderDims(out, source));
    meta = [...named(trusted, cont.map((r, i) => contName(r, i, cont))), ...own].slice(0, PART_REFS_MAX);
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
  // (the same inputs priced the same way: this only differs if the price table changed during the request)
  if (!priceAgreed(owner, first.coins, final.coins!)) return { kind: "price_changed", coins: final.coins!, lines: final.lines! };

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
    if (msg.includes("JAWAD_INSUFFICIENT")) throw new UserError(`رصيدك من النقود الذكية لا يكفي: هذا التعديل يحتاج ${coinStr(final.coins)}.`, 402);
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

const IMAGE_SYSTEM = `In the JAWAD AI image studio you write the prompt for OpenAI's GPT Image 2. You run in the background; the person never sees this exchange. Answer only with the JSON object {"prompt": "...", "kept": [...]}.

The user made an image with the PREVIOUS PROMPT and settings given in the message; that result is attached as @result. They then wrote, precisely, what to change.

When the mode is SAME (edit the same image): the generator receives @result as its input image. Write an edit prompt that states exactly what to change (where in the image and how) and says clearly that everything else must stay exactly as it is: composition, framing, people and their faces, poses, hands, clothing, every piece of text, colors, lighting, style and image quality. Refer to the input image only as @result.

When the mode is FULL (make the image again): a FRESH GENERATION. The generator does NOT receive @result; it receives only the references listed in the message (if any). Write a complete, standalone prompt from the previous prompt's ideas with the user's change built in as simply how the image is. Write only what should be there, positively: never mention the previous image, a mistake, a fix or a change, and never describe the unwanted result, not even to forbid it (naming it brings it back). Refer to references only by their @name, exactly as given; never mention @result.

Rules:
- Write in English (the generator follows it best), except text that must appear in the image: keep it exactly in its language and spelling, inside double quotes.
- At most 1,500 characters. Concrete and visual; no explanations, no alternatives, no lists of options.
- Do not add anything the user did not ask for. Never invent a reference or a name.`;

const IMAGE_SCHEMA = { type: "object", properties: { prompt: { type: "string" }, kept: LOCKS_SCHEMA.properties.locks }, required: ["prompt", "kept"], additionalProperties: false };

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
 * The edit in numbers, for the continuity method's checker and worked examples (config/jawad/smart-edit-training.ts):
 * the video, what was marked, the cut, the continuity and sound references, the other references, the locks' key words.
 */
function editModelOf(edit: EditInputs, videoSec: number, names: string[], locks: EditLock[]): EditModel | null {
  if (!edit.cut) return null;
  const r = edit.ranges[0] ?? { from: edit.cut.start, to: edit.cut.end };
  const cont = edit.continuity ?? continuityRanges(edit.cut, videoSec);
  const contNames = new Set(cont.map((c, i) => contName(c, i, cont)));
  return {
    videoSec,
    marked: { from: Math.max(edit.cut.start, r.from), to: Math.min(edit.cut.end, r.to) },
    cut: edit.cut,
    continuity: cont,
    sounds: names.filter((n): n is "sound_before" | "sound_after" => n === "sound_before" || n === "sound_after"),
    refs: names.filter((n) => !contNames.has(n) && !n.startsWith("sound_")),
    lockWords: locks.flatMap((l) => l.check),
  };
}

/**
 * Before an edit job is sent: جواد writes the final prompt. The request reaches him as it is — the person's own words,
 * untouched — with the whole shot (the previous prompt as written and as the generator got it, the settings, the frames,
 * the references, the continuity pieces and sound, the film's brief from سجاد). He decides, in ONE answer, the prompt
 * and the locks he carries over; nothing writes before him and nothing rewrites after him (the website's mechanical
 * rules only send a fault back to him). Videos use the Super Director's craft as his own skill; images a focused one.
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
    let prompt: string;
    let usd = 0;
    let locks: EditLock[] = [];
    // the person's own words, untouched, and the whole shot's record (the film's brief too: it is for him, not for a go-between)
    const brief = source.inputs.film?.projectId ? await sajjadBrief({ filmProjectId: source.inputs.film.projectId }).catch(() => null) : null;
    const words = personWordsText(edit.notes, edit.ranges);
    const frameUrls = def.output === "video" ? await signed(edit.frames.map((f) => f.path)) : [];
    const lockCheck = (p: string, kept: EditLock[]) => {
      const miss = missingLocks(p, kept);
      return miss.length ? [missingText(miss)] : [];
    };
    if (def.output === "video") {
      const s = job.inputs.settings;
      const videoSec = (Number(out?.duration_ms) || Number(source.inputs.settings.duration) * 1000) / 1000;
      const model = edit.mode === "parts" ? editModelOf(edit, videoSec, names, []) : null;
      const task =
        edit.mode === "parts"
          ? `Mode: ONLY A PART is regenerated. The part from ${edit.cut!.start.toFixed(1)} s to ${edit.cut!.end.toFixed(1)} s of the original video is replaced by a new ${edit.cut!.seconds}-second clip, cut in so that nobody can see the joins.
CONTINUITY (the most important thing): ${continuityText(edit)}${names.some((n) => n.startsWith("sound_")) ? ` SOUND CONTINUITY: ${names.includes("sound_before") ? "@sound_before is the original's sound in the seconds right before the cut" : ""}${names.includes("sound_before") && names.includes("sound_after") ? " and " : ""}${names.includes("sound_after") ? "@sound_after the sound right after it" : ""}: the new clip's sound continues it seamlessly — the same voices (timbre, pitch, pace) with any line in progress finishing naturally, the same ambience and sound effects, and the same music (tempo, key, instruments, level) running straight through both joins, no new music or sudden silence.` : ""} The other references are the original's characters and places.${model && timingBlock(model) ? `\n\n${timingBlock(model)}` : ""}\n\n${CONTINUITY_METHOD}${model ? `\n\n${editModelsBrief(model, 2)}` : ""}`
          : "Mode: the WHOLE clip is made again as a fresh generation, with the same settings and references (the old video is not sent to the generator).";
      const parts: ClaudePart[] = [
        { type: "text", text: settingsText(def, s, job.mode, meta) },
        { type: "text", text: `${task}\n\n${shotRecordText({ previous, settings: source.inputs.settings, videoSec, filmBrief: brief })}` },
      ];
      edit.frames.forEach((f, i) => {
        if (frameUrls[i]) parts.push({ type: "text", text: `Frame of the old video at ${f.t.toFixed(1)} s (for your understanding only):` }, { type: "image", url: frameUrls[i]! });
      });
      const refUrls = await signed(found.rows.filter((r) => r.kind === "image").slice(0, 8).map((r) => r.storage_path));
      found.rows.filter((r) => r.kind === "image").slice(0, 8).forEach((r, i) => {
        const m = meta[found.rows.indexOf(r)];
        if (refUrls[i]) parts.push({ type: "text", text: `@${m.name}:` }, { type: "image", url: refUrls[i]! });
      });
      parts.push({ type: "text", text: KEPT_RULES }, { type: "text", text: words });
      // his own declared locks and the continuity checker read the prompt before it goes (what is missing is sent back to him)
      const r = await directorRun(EDIT_TASK, parts, names, (p, kept) => [...lockCheck(p, kept), ...(model ? checkEditPrompt(p, model).map((x) => x.text) : [])], { identity: JAWAD_EDIT_IDENTITY, keep: { previous } });
      prompt = r.prompt;
      usd = r.usd;
      locks = r.kept;
    } else {
      const [resultUrl] = await signed(out ? [out.storage_path] : []);
      const parts: ClaudePart[] = [
        {
          type: "text",
          text: [
            `Mode: ${edit.mode === "same" ? "SAME (edit the same image)" : "FULL (make the image again)"}`,
            `Settings: ${JSON.stringify(job.inputs.settings)}`,
            edit.mode === "full" ? (meta.length ? `References sent to the generator: ${names.map((n) => `@${n}`).join(", ")}` : "References sent to the generator: none.") : "",
            shotRecordText({ previous, settings: source.inputs.settings, filmBrief: brief }),
          ].filter(Boolean).join("\n\n"),
        },
      ];
      if (resultUrl) parts.push({ type: "text", text: "@result (the image that was made):" }, { type: "image", url: resultUrl });
      if (edit.mode === "full") {
        const refUrls = await signed(found.rows.slice(0, 8).map((r) => r.storage_path));
        found.rows.slice(0, 8).forEach((_, i) => refUrls[i] && parts.push({ type: "text", text: `@${meta[i].name}:` }, { type: "image", url: refUrls[i]! }));
      }
      // «SAME» edits the picture itself, so nothing else can move there anyway: no locks to declare
      parts.push({ type: "text", text: edit.mode === "same" ? 'Leave "kept" empty: the picture itself stays as it is.' : KEPT_RULES }, { type: "text", text: words });
      let turns: ClaudeTurn[] = [{ role: "user", content: parts }];
      const usage: ClaudeUsage[] = [];
      let written: string | null = null;
      for (let attempt = 1; attempt <= 2 && written === null; attempt++) {
        const r = await callClaudeJson<{ prompt: string; kept?: unknown }>({ system: `${JAWAD_EDIT_IDENTITY}\n\n---\n\n${IMAGE_SYSTEM}`, turns, schema: IMAGE_SCHEMA, maxTokens: 8000 });
        usage.push(r.usage);
        const kept = edit.mode === "same" ? [] : readLocks({ locks: r.data.kept }, previous);
        const problems = imagePromptProblems(r.data.prompt ?? "", names, edit.mode);
        // the locks he declared are checked once the rules hold; on the last try a prompt that misses one is still used
        if (!problems.length && attempt < 2) problems.push(...lockCheck(r.data.prompt ?? "", kept));
        if (!problems.length) {
          written = r.data.prompt.trim();
          locks = kept;
        } else turns = [...turns, { role: "assistant", content: r.raw }, { role: "user", content: `Fix these and return the complete JSON again:\n- ${problems.join("\n- ")}` }];
      }
      if (written === null) throw new Error("image prompt broke the rules twice");
      prompt = written;
      usd = usage.reduce((t, u) => t + claudeCost(u), 0);
    }

    const modelPrompt = def.refLabel ? promptForModel(prompt, meta, def.refLabel).text : prompt;
    const kept = missingLocks(prompt, locks);
    if (kept.length) console.warn("smart edit: locks not kept", { job: job.id, missing: kept.map((l) => l.keep) });
    const inputs = { ...job.inputs, ...(modelPrompt !== prompt ? { modelPrompt } : {}), edit: { ...edit, locks, done: true, writer: "jawad" as const, claudeUsd: Number(usd.toFixed(4)) } };
    const { data } = await db().from("jawad_jobs").update({ prompt, inputs, provider_status: null, lease_until: new Date(Date.now() + 7 * 60_000).toISOString() }).eq("id", job.id).select("*").single();
    console.info("jawad smart edit", { job: job.id, mode: edit.mode, locks: locks.length, usd: Number(usd.toFixed(4)) });
    // سجاد hears what the edit kept, so the film's story stays one
    if (locks.length && source.inputs.film?.projectId) await tellSajjad(source.inputs.film.projectId, `التعديل الذكي على ${source.inputs.film.genId ?? "المقطع"} حافظ على قيود الأصل: ${locksForSajjad(locks)}${kept.length ? ` (ما قدر يثبّت: ${kept.map((l) => l.keep).join("؛ ")})` : ""}.`).catch(() => {});
    return data as JobRow;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError("rejected", "تعذّر كتابة البرومبت المعدّل الآن. أُعيدت لك نقودك؛ جرّب مرة ثانية.", `smart edit prompt: ${e instanceof Error ? e.message : String(e)}`);
  }
}
