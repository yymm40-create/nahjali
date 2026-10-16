import { NextResponse, after } from "next/server";
import { ZAYNAB_IMAGE, ZAYNAB_KEY_PREFIX, ZAYNAB_MAX_PHOTOS, zaynabInput, zaynabPrompt } from "@config/jawad/zaynab";
import { generatorById } from "@config/jawad/generators";
import { can, permForGenerator } from "@/lib/access";
import { handle, UserError } from "@/lib/api";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { freeFirstEligible } from "@/lib/jawad/server/free-first";
import { createJob, advanceJob, type JobRow } from "@/lib/jawad/server/jobs";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { requireCreated } from "@/lib/jawad/server/cartoon";
import { jobViews } from "@/lib/jawad/server/works";
import { isUuid, uploadFromBuffer } from "@/lib/jawad/server/uploads";
import { viewBytes, zaynabQuote } from "@/lib/jawad/server/zaynab";

export const maxDuration = 300;

/** «في حضرة السيدة زينب (ع)»: unlisted (no card, no link: only its own address), same sign-in and coins as the rest. */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = await req.json();
  let input;
  try { input = zaynabInput(body.input); } catch (error) { throw new UserError((error as Error).message, 400); }
  const uploads: unknown[] = Array.isArray(body.uploads) ? body.uploads : [];
  if (uploads.length < 1 || uploads.length > ZAYNAB_MAX_PHOTOS || uploads.some((id) => !isUuid(id)) || new Set(uploads).size !== uploads.length) throw new UserError(`ارفع من صورة إلى ${ZAYNAB_MAX_PHOTOS} صور مختلفة.`, 400);
  const rt = await loadRuntime();
  const live = rt.generators.find((generator) => generator.id === ZAYNAB_IMAGE);
  if (!live || !(live.live || (owner && live.keyConfigured)) || !(await can(user.email, permForGenerator(generatorById(ZAYNAB_IMAGE)!)))) throw new UserError("مولد الصور غير متاح لحسابك حاليًا.", 403);
  const quote = await zaynabQuote(input, uploads.length);
  // «أول تجربة مجانية»: the account's first attempt, one picture, while the offer is open
  const key = ZAYNAB_KEY_PREFIX + String(body.key ?? "");
  const db = createAdminClient();
  const existing = isUuid(body.key) ? await db.from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle() : { data: null };
  const firstFree = !owner && input.count === 1 && !existing.data && (await freeFirstEligible(user.id, ZAYNAB_KEY_PREFIX));
  const coins = firstFree ? 0 : quote.coins;
  if (body.action === "quote") return NextResponse.json({ quote: { coins, fullCoins: quote.coins }, free: owner, firstFree });
  if (!isUuid(body.key)) throw new UserError("معرّف طلب غير صالح.", 400);
  if (existing.data) return NextResponse.json({ key, jobs: await jobViews([existing.data as JobRow]) });
  if (body.expectedCoins !== coins) throw new UserError("تغيّر السعر؛ اعرض السعر الحالي قبل التنفيذ.", 409);
  if (!owner && (await coinBalance(user.id) ?? 0) < coins) throw new UserError("رصيدك لا يكفي. اشحن الرصيد أولًا.", 402);
  // the chosen view of the courtyard goes first, as a reference of its own, with every generation
  const place = await uploadFromBuffer(user.id, await viewBytes(input.view), `${input.view}.jpg`);
  const result = requireCreated(await createJob(user, owner, {
    idempotencyKey: key, generatorId: ZAYNAB_IMAGE, sectionId: quote.section,
    prompt: zaynabPrompt(input, uploads.length), settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: input.count },
    refs: [place.id, ...(uploads as string[])].map((uploadId) => ({ uploadId, role: "reference" })), refStyle: "references", expectedCoins: coins,
  }, new URL(req.url).origin, { free: firstFree }));
  return NextResponse.json({ key, jobs: await jobViews([result.job]) });
});

export const GET = handle(async () => {
  const { user, owner } = await requireJawadApiUser();
  const { data, error } = await createAdminClient().from("jawad_jobs").select("*").eq("user_id", user.id).like("idempotency_key", ZAYNAB_KEY_PREFIX + "%").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  const jobs = (data ?? []) as JobRow[];
  for (const job of jobs) if (["queued", "running", "submitting", "saving"].includes(job.status)) after(() => advanceJob(job).catch((e) => console.error("zaynab advance", e)));
  return NextResponse.json({ firstFree: !owner && (await freeFirstEligible(user.id, ZAYNAB_KEY_PREFIX)), jobs: await jobViews(jobs) });
});
