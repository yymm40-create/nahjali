// «مكتب جواد» — how «محمد باقر» generates: he never calls a picture or video provider himself. He hands جواد a request
// (what to make, in what shape, from which references, with which exact prompt) and جواد — who owns generation on the
// platform — receives it, picks his generator, checks the options against his registry, prices it, makes it as an
// ordinary JAWAD AI job (so it is in «أعمالي», follows the site's prices, refunds on failure and keeps the one
// provider key and the one ledger), and answers with a receipt and the result. Baqir's «content» permission is what
// lets his requests in (src/lib/jawad/server/jobs.ts, via: "content"); «قنبر» draws a game's pictures through the same desk
// (src/lib/games/build.ts), behind the door of «صانع الألعاب» he already passed. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { generatorById } from "@config/jawad/generators";
import type { GeneratorDef, Settings } from "@config/jawad/types";
import { advanceJob, createJob, loadJob, runJob, type GenerateBody, type JobRow } from "@/lib/jawad/server/jobs";
import { JAWAD_BUCKET, loadRuntime } from "@/lib/jawad/server/runtime";
import { uploadFromBuffer } from "@/lib/jawad/server/uploads";

const db = () => createAdminClient();

/** The generator جواد picks for each kind of request (the owner's registry decides what exists and what it costs). */
export const DESK_GENERATOR = { image: "openai-gpt-image-2", video: "byteplus-seedance-2-5" } as const;
export const SECONDS = { min: 4, max: 15 } as const;

export interface DeskRequest {
  /** the same key = the same request (a repeat returns the job already made); 8–80 of A-Z a-z 0-9 _ - */
  key: string;
  kind: "image" | "video";
  /** Baqir's prompt, final: جواد uses it as it is */
  prompt: string;
  aspect: string;
  /** image: low | medium | high (default high, for readable Arabic) */
  quality?: string;
  /** image: std | hi — video: 480p | 720p | 1080p */
  resolution?: string;
  /** video: 4–15 */
  seconds?: number;
  /** video: its own generated sound (default on, as the registry has it) */
  withSound?: boolean;
  /** the person's own stored pictures to use as references (jawad_uploads ids) with the names they go by */
  refs?: { uploadId: string; name: string }[];
}

export interface DeskWho {
  id: string;
  email?: string | null;
  /** everyone the dashboard lets in makes for free (see requireJawadApiUser) */
  owner: boolean;
  origin: string;
}

export interface DeskReceipt {
  generatorId: string;
  generator: string;
  /** what جواد set, in the registry's own keys */
  settings: Settings;
  coins: number;
  /** nothing is taken from the person's coins */
  free: boolean;
  jobId: string;
}

export interface DeskOutput {
  jobId: string;
  outputId: string;
  path: string;
  mime: string;
  kind: "image" | "video" | "audio";
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

/** A request جواد could not carry out: what to tell the person, the technical reason, and whether trying again can help. */
export class DeskError extends Error {
  constructor(
    public reason: string,
    public detail = "",
    public transient = false,
  ) {
    super(reason);
  }
}

/** A refusal for a moment (busy, a cut connection, a server hiccup): worth another try. */
export const isTransientText = (s: string) => /^(429|408|5\d\d)\b|rate.?limit|overload|timeout|temporar|worker lost|ECONN|fetch failed|مشغول|انقطع/i.test(s);

/** The value if the generator's option really has it, else the fallback. */
function option(def: GeneratorDef, key: string, value: unknown, fallback: string): string {
  const o = def.options.find((x) => x.key === key);
  const ok = o?.kind === "choice" && o.values.some((v) => v.value === String(value));
  return ok ? String(value) : fallback;
}

/** The registry's settings for a request (جواد's own knowledge of his generators). */
export function deskSettings(def: GeneratorDef, req: DeskRequest): Settings {
  if (req.kind === "image") {
    return { aspect: option(def, "aspect", req.aspect, "1:1"), resolution: option(def, "resolution", req.resolution, "std"), quality: option(def, "quality", req.quality, "high"), count: 1 };
  }
  const seconds = Math.max(SECONDS.min, Math.min(SECONDS.max, Math.round(Number(req.seconds) || 5)));
  return { ratio: option(def, "ratio", req.aspect, "9:16"), resolution: option(def, "resolution", req.resolution, "720p"), duration: seconds, audio: req.withSound !== false };
}

const receiptOf = (def: GeneratorDef, job: JobRow): DeskReceipt => ({
  generatorId: def.id,
  generator: def.name,
  settings: job.inputs.settings ?? {},
  coins: job.price_coins,
  free: job.charge_state === "none",
  jobId: job.id,
});

/** The generator and the job's body for a request (the price still to learn: expectedCoins -1). */
async function bodyOf(req: DeskRequest): Promise<{ def: GeneratorDef; body: GenerateBody }> {
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(req.key)) throw new DeskError("طلب غير صحيح.", "bad key");
  if (!req.prompt.trim()) throw new DeskError("طلب بلا وصف.", "empty prompt");
  const def = generatorById(DESK_GENERATOR[req.kind]);
  if (!def) throw new DeskError("المولد غير معروف.", `unknown generator ${DESK_GENERATOR[req.kind]}`);
  const rt = await loadRuntime();
  const rg = rt.generators.find((g) => g.id === def.id);
  if (!rt.migrated || !rg) throw new DeskError("منصة جواد قيد التجهيز.", "runtime not ready", true);
  const refs = req.refs ?? [];
  const body: GenerateBody = {
    idempotencyKey: req.key,
    sectionId: rg.sectionId,
    generatorId: def.id,
    refStyle: refs.length ? "references" : "none",
    settings: deskSettings(def, req),
    prompt: req.prompt,
    instructions: "",
    refs: refs.map((r) => ({ uploadId: r.uploadId, role: "reference", name: r.name })),
    expectedCoins: -1,
  };
  return { def, body };
}

/** What a request would cost the person now, in halalas (nothing is made or taken); null when it can't be priced. */
export async function deskQuote(who: DeskWho, req: Omit<DeskRequest, "key">): Promise<number | null> {
  try {
    const { body } = await bodyOf({ ...req, key: `quote-${crypto.randomUUID()}` });
    const r = await createJob({ id: who.id, email: who.email }, who.owner, body, who.origin, { via: "content" });
    return r.kind === "price_changed" ? r.coins : null;
  } catch {
    return null;
  }
}

/** جواد receives a request and makes the job (nothing is waited for: the work runs after, or at once for a picture). */
async function receive(who: DeskWho, req: DeskRequest): Promise<{ def: GeneratorDef; job: JobRow }> {
  const { def, body } = await bodyOf(req);
  const user = { id: who.id, email: who.email };
  try {
    // the first ask learns the price (nothing is made or taken), the second makes the job at exactly that price
    let r = await createJob(user, who.owner, body, who.origin, { via: "content" });
    if (r.kind === "price_changed") r = await createJob(user, who.owner, { ...body, expectedCoins: r.coins }, who.origin, { via: "content" });
    if (r.kind === "issues") throw new DeskError(r.issues[0]?.message ?? "الطلب غير صالح.", JSON.stringify(r.issues));
    if (r.kind === "price_changed") throw new DeskError("تغيّر السعر أثناء الطلب. جرّب مرة ثانية.", `price ${r.coins}`, true);
    return { def, job: r.job };
  } catch (e) {
    if (e instanceof DeskError) throw e;
    if (e instanceof UserError) throw new DeskError(e.message, `UserError ${e.status}`, e.status === 429);
    throw new DeskError("صار خطأ غير متوقع عند جواد.", String(e instanceof Error ? e.message : e));
  }
}

async function outputOf(jobId: string): Promise<DeskOutput | null> {
  const { data } = await db().from("jawad_outputs").select("id,kind,storage_path,mime,width,height,duration_ms").eq("job_id", jobId).order("idx").limit(1).maybeSingle();
  if (!data) return null;
  return { jobId, outputId: data.id as string, path: data.storage_path as string, mime: String(data.mime), kind: data.kind as DeskOutput["kind"], width: (data.width as number | null) ?? null, height: (data.height as number | null) ?? null, durationMs: (data.duration_ms as number | null) ?? null };
}

/** The bytes of a made file (a picture جواد made, for the check after it and for the next slide's reference). */
export async function deskBytes(path: string): Promise<Buffer> {
  const dl = await storage.from(JAWAD_BUCKET).download(path);
  if (dl.error || !dl.data) throw new DeskError("ما قدرنا نقرأ الصورة اللي ولّدها جواد.", "output download failed", true);
  return Buffer.from(await dl.data.arrayBuffer());
}

const failure = (job: JobRow) => new DeskError(job.error_message || "فشل التوليد عند جواد.", job.error_detail || job.error_message || "", isTransientText(`${job.error_detail ?? ""} ${job.error_message ?? ""}`));

/**
 * A picture: جواد makes it and the answer comes back with it (a picture takes about a minute). Throws DeskError with
 * the reason when he could not.
 */
export async function deskImage(who: DeskWho, req: DeskRequest): Promise<{ out: DeskOutput; bytes: Buffer; receipt: DeskReceipt }> {
  const { def, job } = await receive(who, { ...req, kind: "image" });
  // the job also starts itself after the response; the claim makes this call the one that does (a picture answers in the same request)
  await runJob(job.id);
  const done = (await loadJob(job.id)) ?? job;
  if (done.status === "failed" || done.status === "cancelled") throw failure(done);
  if (done.status !== "succeeded") throw new DeskError("لم يكتمل التوليد في الوقت المتوقع.", `status ${done.status}`, true);
  const out = await outputOf(job.id);
  if (!out) throw new DeskError("اكتمل التوليد لكن ما وصلت النتيجة.", "no output row", true);
  return { out, bytes: await deskBytes(out.path), receipt: receiptOf(def, done) };
}

/** A video: جواد takes the request and starts it; it takes minutes, so the answer is the receipt (see deskCheck). */
export async function deskVideo(who: DeskWho, req: DeskRequest): Promise<DeskReceipt> {
  const { def, job } = await receive(who, { ...req, kind: "video" });
  return receiptOf(def, job);
}

export type DeskState = { state: "running"; status: string; progress: number | null } | { state: "done"; out: DeskOutput } | { state: "failed"; error: DeskError };

/** Where a job stands now (a video moves forward each time this asks). */
export async function deskCheck(userId: string, jobId: string): Promise<DeskState> {
  let job = await loadJob(jobId);
  if (!job || job.user_id !== userId) return { state: "failed", error: new DeskError("ما لقينا هذا التوليد عند جواد.", "job not found") };
  if (job.status !== "succeeded" && job.status !== "failed" && job.status !== "cancelled") {
    await advanceJob(job).catch((e) => console.error("desk advance", jobId, e));
    job = (await loadJob(jobId)) ?? job;
  }
  if (job.status === "succeeded") {
    const out = await outputOf(jobId);
    return out ? { state: "done", out } : { state: "failed", error: new DeskError("اكتمل التوليد لكن ما وصلت النتيجة.", "no output row", true) };
  }
  if (job.status === "failed" || job.status === "cancelled") return { state: "failed", error: failure(job) };
  return { state: "running", status: job.provider_status ?? job.status, progress: job.progress };
}

/** A made picture kept as a stored reference of the person's (so the next generation can follow it). Returns its id. */
export async function deskReference(userId: string, bytes: Buffer, name: string): Promise<string> {
  try {
    const row = await uploadFromBuffer(userId, new Uint8Array(bytes), `${name}.png`);
    return row.id;
  } catch (e) {
    if (e instanceof UserError) throw new DeskError(e.message, `UserError ${e.status}`);
    throw e;
  }
}
