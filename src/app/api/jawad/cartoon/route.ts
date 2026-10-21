import { NextResponse, after } from "next/server";
import { CARTOON_IMAGE, CARTOON_VIDEO, CARTOON_PRICE, cartoonInput, cartoonImagePrompt, hasArabic } from "@config/jawad/cartoon";
import { callClaudeJson } from "@/lib/film/anthropic";
import { generatorById } from "@config/jawad/generators";
import { can, permForGenerator } from "@/lib/access";
import { handle, UserError } from "@/lib/api";
import { coinBalance, holdCoins } from "@/lib/coins";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireJawadApiUser } from "@/lib/jawad/server/access";
import { freeFirstEligible } from "@/lib/jawad/server/free-first";
import { cartoonQuote, continueCartoon, directCartoon, planOf, requireCreated } from "@/lib/jawad/server/cartoon";
import { createJob, advanceJob, type JobRow } from "@/lib/jawad/server/jobs";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { jobViews } from "@/lib/jawad/server/works";
import { isUuid } from "@/lib/jawad/server/uploads";

export const maxDuration = 300;

/** A child's story written in Arabic, told again in plain English for a 15-second film (the film model reads no Arabic). */
async function storyInEnglish(text: string): Promise<string> {
  try {
    const r = await callClaudeJson<{ en: string }>({
      system: "You translate a short story for a 15-second children's cartoon film into clear English stage directions. Keep every event, name and detail; no additions; split it into 3–4 beats with their seconds (0–4s, 4–8s, 8–12s, 12–15s). Return only the English.",
      turns: [{ role: "user", content: text.slice(0, 3000) }],
      schema: { type: "object", additionalProperties: false, required: ["en"], properties: { en: { type: "string" } } },
      maxTokens: 800,
      effort: "low",
    });
    const en = String(r.data.en ?? "").trim();
    return hasArabic(en) ? "" : en.slice(0, 1500);
  } catch {
    // without it the film keeps a gentle adventure for the character (never blocked)
    return "";
  }
}
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
  // a run saved before the parts existed: the person's story, in Arabic, made English for the film (Seedance 2.0 reads no Arabic)
  if (input.video && !input.scenes.length && input.story === "custom" && hasArabic(input.customStory)) input.storyEn = await storyInEnglish(input.customStory);
  const full = await cartoonQuote(input);
  // «أول تجربة مجانية»: the account's first attempt — its first picture — while the offer is open (more pictures and the film are paid)
  const key = "cartoon_" + body.key;
  const db = createAdminClient();
  const existing = isUuid(body.key) ? await db.from("jawad_jobs").select("*").eq("user_id", user.id).eq("idempotency_key", key + "_0").maybeSingle() : { data: null };
  const firstFree = !owner && !existing.data && (await freeFirstEligible(user.id, "cartoon_"));
  const quote = firstFree ? { ...full, imageCoins: full.imageCoins - CARTOON_PRICE, totalCoins: full.totalCoins - CARTOON_PRICE } : full;
  if (body.action === "quote") return NextResponse.json({ quote, free: owner, firstFree });
  if (!isUuid(body.key)) throw new UserError("معرّف طلب غير صالح.", 400);
  if (existing.data) return NextResponse.json({ key, jobs: await jobViews([existing.data as JobRow]) });
  if (body.expectedCoins !== quote.totalCoins) throw new UserError("تغيّر السعر؛ اعرض السعر الحالي قبل التنفيذ.", 409);
  if (!owner && (await coinBalance(user.id) ?? 0) < quote.totalCoins) throw new UserError("رصيدك لا يكفي لإكمال الطلب كله. اشحن الرصيد أولًا.", 402);
  if (!Array.isArray(body.uploads) || body.uploads.length < 1 || body.uploads.length > 3 || body.uploads.some((id: unknown) => !isUuid(id)) || new Set(body.uploads).size !== body.uploads.length) throw new UserError("ارفع ١–٣ صور مختلفة.", 400);
  // «المخرج الخارق» writes each part of the character's film from the person's words, before anything starts; a part
  // he could not write is told plainly (translated when it is Arabic) and costs nothing
  let directorCoins = 0;
  if (input.video && input.mode !== "scene" && input.scenes.length) {
    const { directed, written } = await directCartoon(input);
    input.directed = await Promise.all(directed.map(async (prompt, i) => prompt || (hasArabic(input.scenes[i]) ? await storyInEnglish(input.scenes[i]).then(en => (en ? "15 seconds, vertical 9:16 cartoon film.\nStory: " + en : "")) : "")));
    directorCoins = owner || !input.scenes.length ? 0 : Math.round((quote.directorCoins / input.scenes.length) * written);
  }
  const result = requireCreated(await createJob(user, owner, {
    idempotencyKey: key + "_0", generatorId: CARTOON_IMAGE, sectionId: quote.imageSection,
    prompt: cartoonImagePrompt(input), settings: { aspect: input.aspect, resolution: "std", quality: "medium", count: 1 },
    refs: body.uploads.map((uploadId: string) => ({ uploadId, role: "reference" })), refStyle: "references", expectedCoins: firstFree ? 0 : CARTOON_PRICE,
  }, new URL(req.url).origin, { free: firstFree, cartoon: { key, input, videoCoins: quote.partCoins, position: 0, expiresAt: Date.now() + 24 * 3600_000 } }));
  // only the parts the director actually wrote are paid, once the run has really started
  if (directorCoins && result.kind === "created") await holdCoins(user.id, directorCoins, `cartoon-director:${key}`, "JAWAD AI · المخرج الخارق · فيلم الكرتون").catch(error => console.error("cartoon director charge", error));
  return NextResponse.json({ key, jobs: await jobViews([result.job]) });
});

export const GET = handle(async () => {
  const { user, owner } = await requireJawadApiUser();
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
  const firstFree = !owner && (await freeFirstEligible(user.id, "cartoon_"));
  return NextResponse.json({ firstFree, runs: [...new Set(jobs.map(job => planOf(job)?.key).filter(Boolean))].map(key => {
    const plan = planOf(jobs.find(job => planOf(job)?.key === key)! )!;
    return { key, input: plan.input, error: messages[key!], jobs: views.filter(view => jobs.some(job => job.id === view.id && planOf(job)?.key === key)).reverse() };
  }) });
});

