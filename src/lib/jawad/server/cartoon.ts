import { CARTOON_IMAGE, CARTOON_VIDEO, CARTOON_PRICE, cartoonVideoSettings, cartoonImagePrompt, cartoonVideoPrompt, type CartoonInput } from "@config/jawad/cartoon";
import { generatorById } from "@config/jawad/generators";
import { unlimitedFor } from "@/lib/access";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluate } from "../engine";
import { createJob, type JobRow, type CreateResult } from "./jobs";
import { uploadFromOutput } from "./uploads";
import { loadRuntime } from "./runtime";

export interface CartoonPlan {
  key: string;
  input: CartoonInput;
  videoCoins: number;
  position: number;
  expiresAt: number;
}
export const planOf = (job: JobRow) => (job.inputs as JobRow["inputs"] & { cartoon?: CartoonPlan }).cartoon;
export async function cartoonQuote(input: CartoonInput) {
  const rt = await loadRuntime();
  const image = rt.generators.find(generator => generator.id === CARTOON_IMAGE);
  const video = rt.generators.find(generator => generator.id === CARTOON_VIDEO);
  let videoCoins = 0;
  if (input.video) {
    const result = evaluate(generatorById(CARTOON_VIDEO)!, {
      settings: cartoonVideoSettings(input), prompt: cartoonVideoPrompt(input), instructions: "", refStyle: "none", refs: [], strict: true,
    }, rt.prices[CARTOON_VIDEO]);
    if (!result.price.ok || result.issues.length) throw new UserError("تعذّر تسعير فيديو ١٥ ثانية؛ جرّب الصور فقط.", 503);
    videoCoins = result.price.coins;
  }
  return { imageCoins: CARTOON_PRICE * input.count, videoCoins, totalCoins: CARTOON_PRICE * input.count + videoCoins, imageSection: image?.sectionId ?? "images", videoSection: video?.sectionId ?? "video" };
}
export function requireCreated(result: CreateResult) {
  if (result.kind === "issues") throw new UserError(result.issues[0]?.message ?? "تعذّر التوليد.", 422);
  if (result.kind === "price_changed") throw new UserError("تغيّر السعر. لم يبدأ هذا التوليد؛ راجع السعر وأعد المحاولة.", 409);
  return result;
}
export async function continueCartoon(jobId: string) {
  const db = createAdminClient();
  const { data: row } = await db.from("jawad_jobs").select("*").eq("id", jobId).maybeSingle();
  const job = row as JobRow | null;
  if (!job || job.status !== "succeeded") return;
  const plan = planOf(job);
  if (!plan) return;
  const next = plan.position + 1;
  if (next > plan.input.count || (next === plan.input.count && !plan.input.video)) return;
  const nextKey = plan.key + "_" + next;
  const existing = await db.from("jawad_jobs").select("id").eq("user_id", job.user_id).eq("idempotency_key", nextKey).maybeSingle();
  if (existing.data) return;
  if (Date.now() > plan.expiresAt) throw new UserError("انتهت صلاحية إذن التوليد؛ نتائجك محفوظة، ابدأ طلبًا جديدًا لإكمال المزيد.", 409);
  const { data: auth } = await db.auth.admin.getUserById(job.user_id);
  if (!auth.user) throw new UserError("تعذّر العثور على الحساب.", 404);
  const owner = await unlimitedFor(auth.user.email);
  const root = await db.from("jawad_jobs").select("id").eq("user_id", job.user_id).eq("idempotency_key", plan.key + "_0").single();
  if (!root.data) throw new UserError("لم نجد أصل الشخصية.", 404);
  const output = await db.from("jawad_outputs").select("id").eq("user_id", job.user_id).eq("job_id", root.data.id).eq("kind", "image").order("idx").limit(1).maybeSingle();
  if (!output.data) throw new UserError("لم تُحفظ صورة الشخصية الأصلية بعد.", 409);
  const upload = await uploadFromOutput(job.user_id, output.data.id);
  const video = next === plan.input.count;
  const rt = await loadRuntime();
  const generatorId = video ? CARTOON_VIDEO : CARTOON_IMAGE;
  const sectionId = rt.generators.find(generator => generator.id === generatorId)?.sectionId;
  requireCreated(await createJob(auth.user, owner, {
    idempotencyKey: nextKey, generatorId, sectionId,
    prompt: video ? cartoonVideoPrompt(plan.input) : cartoonImagePrompt(plan.input, true),
    settings: video ? cartoonVideoSettings(plan.input) : { aspect: plan.input.aspect, resolution: "std", quality: "medium", count: 1 },
    refStyle: "references", refs: [{ uploadId: upload.id, role: "reference", name: "character" }],
    expectedCoins: video ? plan.videoCoins : CARTOON_PRICE,
  }, job.inputs.origin ?? "", { cartoon: { ...plan, position: next } }));
}

