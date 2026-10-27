import { NextResponse, after } from "next/server";
import { ZAYNAB_IMAGE, ZAYNAB_KEY_PREFIX, ZAYNAB_MAX_PHOTOS, zaynabInput } from "@config/jawad/zaynab";
import { generatorById } from "@config/jawad/generators";
import { can, permForGenerator } from "@/lib/access";
import { handle, shortBalance, UserError } from "@/lib/api";
import { coinBalance } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { freeFirstEligible } from "@/lib/jawad/server/free-first";
import { createJob, advanceJob, type JobRow } from "@/lib/jawad/server/jobs";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { requireCreated } from "@/lib/jawad/server/cartoon";
import { jobViews } from "@/lib/jawad/server/works";
import { isUuid, uploadFromBuffer, type UploadRow } from "@/lib/jawad/server/uploads";
import { jawadWritesZaynab, promptSealed, sealPrompt, sheetBytes, zaynabQuote } from "@/lib/jawad/server/zaynab";

export const maxDuration = 300;

/**
 * «في حضرة السيدة زينب (ع)»: unlisted (no card, no link: only its own address), same sign-in and coins as the rest.
 * «quote»: «جواد» writes the prompt (looking at the sheet and the photos) and it is priced; «start»: that same prompt,
 * sealed, is made with the sheet and every photo as references.
 */
export const POST = handle(async (req: Request) => {
  const { user, owner } = await requireJawadApiUser();
  const body = await req.json();
  let input;
  try { input = zaynabInput(body.input); } catch (error) { throw new UserError((error as Error).message, 400); }
  const uploads: string[] = Array.isArray(body.uploads) ? body.uploads : [];
  if (uploads.length < 1 || uploads.length > ZAYNAB_MAX_PHOTOS || uploads.some((id) => !isUuid(id)) || new Set(uploads).size !== uploads.length) throw new UserError(`ارفع من صورة إلى ${ZAYNAB_MAX_PHOTOS} صور مختلفة.`, 400);
  const rt = await loadRuntime();
  const live = rt.generators.find((generator) => generator.id === ZAYNAB_IMAGE);
  if (!live || !(live.live || (owner && live.keyConfigured)) || !(await can(user.email, permForGenerator(generatorById(ZAYNAB_IMAGE)!)))) throw new UserError("مولد الصور غير متاح لحسابك حاليًا.", 403);
  const db = createAdminClient();
  const key = ZAYNAB_KEY_PREFIX + String(body.key ?? "");
  const existing = isUuid(body.key) ? await db.from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key).maybeSingle() : { data: null };
  // «أول تجربة مجانية»: the account's first attempt, one picture, while the offer is open
  const firstFree = !owner && input.count === 1 && !existing.data && (await freeFirstEligible(user.id, ZAYNAB_KEY_PREFIX));

  if (body.action === "quote") {
    // the person's own photos, ready, in the order they were added
    const { data } = await db.from("jawad_uploads").select("*").eq("user_id", user.id).in("id", uploads);
    const rows = uploads.map((id) => ((data ?? []) as UploadRow[]).find((r) => r.id === id));
    if (rows.some((r) => !r || r.kind !== "image" || r.status !== "ready")) throw new UserError("انتظر حتى تكتمل الصور، أو احذف الصورة اللي ما انرفعت.", 400);
    const prompt = await jawadWritesZaynab(input, rows as UploadRow[]);
    const quote = await zaynabQuote(input, uploads.length, prompt);
    return NextResponse.json({ quote: { coins: firstFree ? 0 : quote.coins, fullCoins: quote.coins }, free: owner, firstFree, prompt, seal: sealPrompt(user.id, prompt, input, uploads) });
  }

  if (!isUuid(body.key)) throw new UserError("معرّف طلب غير صالح.", 400);
  if (existing.data) return NextResponse.json({ key, jobs: await jobViews([existing.data as JobRow]) });
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!promptSealed(body.seal, user.id, prompt, input, uploads)) throw new UserError("تغيّر الطلب بعد ما كتب «جواد» البرومبت؛ اعرض السعر من جديد.", 409);
  const quote = await zaynabQuote(input, uploads.length, prompt);
  const coins = firstFree ? 0 : quote.coins;
  if (body.expectedCoins !== coins) throw new UserError("تغيّر السعر؛ اعرض السعر الحالي قبل التنفيذ.", 409);
  const balance = owner ? null : ((await coinBalance(user.id)) ?? 0);
  if (balance !== null && balance < coins) throw shortBalance(coins - balance, balance, "هالعملية");
  // the owner's environment sheet goes first, then every photo — all of them references of GPT Image 2
  const sheet = await uploadFromBuffer(user.id, await sheetBytes(), "zaynab-env-sheet.jpg");
  const result = requireCreated(await createJob(user, owner, {
    idempotencyKey: key, generatorId: ZAYNAB_IMAGE, sectionId: quote.section,
    prompt, settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: input.count },
    refs: [sheet.id, ...uploads].map((uploadId) => ({ uploadId, role: "reference" })), refStyle: "references", expectedCoins: coins,
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
