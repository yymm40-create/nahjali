import { NextResponse, after } from "next/server";
import { CARTOON_IMAGE, CARTOON_VIDEO, CARTOON_PRICE, cartoonInput, cartoonImagePrompt } from "@config/jawad/cartoon";
import { generatorById } from "@config/jawad/generators";
import { can, permForGenerator } from "@/lib/access";
import { handle, UserError } from "@/lib/api";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { cartoonQuote, continueCartoon, planOf, requireCreated } from "@/lib/jawad/server/cartoon";
import { createJob, advanceJob, type JobRow } from "@/lib/jawad/server/jobs";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { jobViews } from "@/lib/jawad/server/works";
import { isUuid } from "@/lib/jawad/server/uploads";

export const maxDuration = 300;
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = await req.json();
  let input;
  try { input = cartoonInput(body.input); } catch (error) { throw new UserError((error as Error).message, 400); }
  const rt = await loadRuntime();
  const section = rt.sections.find(section => section.implementation === "cartoon");
  if (!section || (!section.enabled && !owner)) throw new UserError("هذا الفرع غير متاح حاليًا.", 403);
  for (const id of input.video ? [CARTOON_IMAGE, CARTOON_VIDEO] : [CARTOON_IMAGE]) {
    const live = rt.generators.find(generator => generator.id === id);
    if (!live || !(live.live || (owner && live.keyConfigured)) || !(await can(user.email, permForGenerator(generatorById(id)!)))) throw new UserError("أحد مولدات هذا الطلب غير متاح لحسابك؛ جرّب الصور فقط أو تواصل معنا.", 403);
  }
  const quote = await cartoonQuote(input);
  if (body.action === "quote") return NextResponse.json({ quote, free: owner });
  if (!isUuid(body.key)) throw new UserError("معرّف طلب غير صالح.", 400);
  const key = "cartoon_" + body.key;
  const db = createAdminClient();
  const existing = await db.from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key + "_0").maybeSingle();
  if (existing.data) return NextResponse.json({ key, jobs: await jobViews([existing.data as JobRow]) });
  if (body.expectedCoins !== quote.totalCoins) throw new UserError("تغيّر السعر؛ اعرض السعر الحالي قبل التنفيذ.", 409);
  if (!owner && (await coinBalance(user.id) ?? 0) < quote.totalCoins) throw new UserError("رصيدك لا يكفي لإكمال الطلب كله. اشحن الرصيد أولًا.", 402);
  if (!Array.isArray(body.uploads) || body.uploads.length < 1 || body.uploads.length > 3 || body.uploads.some((id: unknown) => !isUuid(id)) || new Set(body.uploads).size !== body.uploads.length) throw new UserError("ارفع ١–٣ صور مختلفة.", 400);
  const result = requireCreated(await createJob(user, owner, {
    idempotencyKey: key + "_0", generatorId: CARTOON_IMAGE, sectionId: quote.imageSection,
    prompt: cartoonImagePrompt(input), settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: 1 },
    refs: body.uploads.map((uploadId: string) => ({ uploadId, role: "reference" })), refStyle: "references", expectedCoins: CARTOON_PRICE,
  }, new URL(req.url).origin, { cartoon: { key, input, videoCoins: quote.videoCoins, position: 0, expiresAt: Date.now() + 24 * 3600_000 } }));
  return NextResponse.json({ key, jobs: await jobViews([result.job]) });
});

export const GET = handle(async () => {
  const { user } = await requireJawadApiUser();
  const { data, error } = await createAdminClient().from("jawad_jobs").select("*").eq("user_id", user.id).like("idempotency_key", "cartoon_%").order("created_at", { ascending: false }).limit(40);
  if (error) throw error;
  const jobs = (data ?? []) as JobRow[];
  const messages: Record<string, string> = {};
  for (const job of jobs) {
    if (!planOf(job)) continue;
    if (job.status === "succeeded") {
      try { await continueCartoon(job.id); } catch (error) { messages[planOf(job)!.key] = error instanceof UserError ? error.message : "تعذّر إكمال المرحلة التالية. نتائجك السابقة محفوظة؛ سنحاول استئنافها دون تكرار الخصم."; }
    } else if (["queued", "running", "submitting", "saving"].includes(job.status)) {
      after(() => advanceJob(job).catch(error => console.error("cartoon advance", error)));
    }
  }
  const views = await jobViews(jobs);
  return NextResponse.json({ runs: [...new Set(jobs.map(job => planOf(job)?.key).filter(Boolean))].map(key => {
    const plan = planOf(jobs.find(job => planOf(job)?.key === key)! )!;
    return { key, input: plan.input, error: messages[key!], jobs: views.filter(view => jobs.some(job => job.id === view.id && planOf(job)?.key === key)).reverse() };
  }) });
});

