import { CARTOON_IMAGE, CARTOON_VIDEO, CARTOON_PLACES, CARTOON_PRICE, CARTOON_STYLES, AUDIENCE_RULES, cartoonFilm, cartoonParts, cartoonVideoSettings, cartoonImagePrompt, cartoonVideoPrompt, hasArabic, type CartoonInput } from "@config/jawad/cartoon";
import { DIRECTOR_PRICE_KEY, generatorById } from "@config/jawad/generators";
import type { ClaudePart } from "@/lib/film/anthropic";
import { unlimitedFor } from "@/lib/access";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluate } from "../engine";
import { createJob, type JobRow, type CreateResult } from "./jobs";
import { uploadFromBuffer, uploadFromOutput } from "./uploads";
import { placeSheetBytes } from "./cartoon-pictures";
import { directorRun, settingsText, WEBSITE_RULES } from "./director";
import { loadRuntime } from "./runtime";

export interface CartoonPlan {
  key: string;
  input: CartoonInput;
  /** the price of ONE 15-second film (every part costs the same) */
  videoCoins: number;
  position: number;
  expiresAt: number;
  /** a film made AFTER the picture: the run it belongs to (shown with it) and the picture it is made from */
  parent?: string;
  source?: string;
  /** the opening offer's free picture or free film (only on that one job; config/jawad/cartoon-offer.ts) */
  freeOffer?: "pic" | "video";
}
export const planOf = (job: JobRow) => (job.inputs as JobRow["inputs"] & { cartoon?: CartoonPlan }).cartoon;
export async function cartoonQuote(input: CartoonInput) {
  const rt = await loadRuntime();
  const image = rt.generators.find(generator => generator.id === CARTOON_IMAGE);
  const video = rt.generators.find(generator => generator.id === CARTOON_VIDEO);
  const parts = cartoonParts(input);
  let partCoins = 0;
  if (parts) {
    const result = evaluate(generatorById(CARTOON_VIDEO)!, {
      settings: cartoonVideoSettings(input), prompt: cartoonVideoPrompt(input), instructions: "", refStyle: "none", refs: [], strict: true,
    }, rt.prices[CARTOON_VIDEO]);
    if (!result.price.ok || result.issues.length) throw new UserError("تعذّر تسعير فيديو ١٥ ثانية؛ جرّب الصور فقط.", 503);
    partCoins = result.price.coins;
  }
  // «المخرج الخارق» develops each part of a character's story, at the studio's own price for one development
  const centi = rt.prices[CARTOON_VIDEO]?.[DIRECTOR_PRICE_KEY];
  const directorCoins = input.mode !== "scene" && input.scenes.length && centi != null ? Math.ceil(centi / 100) * input.scenes.length : 0;
  const videoCoins = partCoins * parts;
  return { imageCoins: CARTOON_PRICE * input.count, videoCoins, partCoins, parts, directorCoins, totalCoins: CARTOON_PRICE * input.count + videoCoins + directorCoins, imageSection: image?.sectionId ?? "images", videoSection: video?.sectionId ?? "video" };
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
  // the pictures first (0 … count-1), then each 15-second part of the film in turn
  if (next >= plan.input.count + cartoonParts(plan.input)) return;
  const nextKey = plan.key + "_" + next;
  const existing = await db.from("jawad_jobs").select("id").eq("user_id", job.user_id).eq("idempotency_key", nextKey).maybeSingle();
  if (existing.data) return;
  if (Date.now() > plan.expiresAt) throw new UserError("انتهت صلاحية إذن التوليد؛ نتائجك محفوظة، ابدأ طلبًا جديدًا لإكمال المزيد.", 409);
  const { data: auth } = await db.auth.admin.getUserById(job.user_id);
  if (!auth.user) throw new UserError("تعذّر العثور على الحساب.", 404);
  const owner = await unlimitedFor(auth.user.email);
  // the picture the film is made from: the one chosen (a film asked for after the picture), or the run's first one
  let sourceId = plan.source ?? null;
  if (!sourceId) {
    const root = await db.from("jawad_jobs").select("id").eq("user_id", job.user_id).eq("idempotency_key", plan.key + "_0").single();
    if (!root.data) throw new UserError("لم نجد أصل الشخصية.", 404);
    const output = await db.from("jawad_outputs").select("id").eq("user_id", job.user_id).eq("job_id", root.data.id).eq("kind", "image").order("idx").limit(1).maybeSingle();
    if (!output.data) throw new UserError("لم تُحفظ صورة الشخصية الأصلية بعد.", 409);
    sourceId = output.data.id as string;
  }
  const upload = await uploadFromOutput(job.user_id, sourceId);
  const video = next >= plan.input.count;
  const part = next - plan.input.count;
  const refs = video ? await filmRefs(job.user_id, plan.input, upload.id) : [{ uploadId: upload.id, role: "reference" as const, name: "character" }];
  const rt = await loadRuntime();
  const generatorId = video ? CARTOON_VIDEO : CARTOON_IMAGE;
  const sectionId = rt.generators.find(generator => generator.id === generatorId)?.sectionId;
  requireCreated(await createJob(auth.user, owner, {
    idempotencyKey: nextKey, generatorId, sectionId,
    prompt: video ? cartoonVideoPrompt(plan.input, part, refs.length > 1) : cartoonImagePrompt(plan.input, true),
    settings: video ? cartoonVideoSettings(plan.input) : { aspect: plan.input.aspect, resolution: "std", quality: "medium", count: 1 },
    refStyle: "references", refs,
    expectedCoins: video ? plan.videoCoins : CARTOON_PRICE,
  }, job.inputs.origin ?? "", { cartoon: { ...plan, position: next, freeOffer: undefined } }));
}


/** «المخرج الخارق» for the cartoon film: the website's task on top of the approved skill. */
const CARTOON_TASK = `

---

## WEBSITE TASK — JAWAD AI CARTOON FILM (applies on top of the skill above)

You run in the background of «حولني الى الستايل الكرتوني»; the person never sees this exchange. They turned their photo into a cartoon character and wrote, in their own words (often Arabic, often short), what should happen in ONE 15-second part of a film of that character. This message IS the final prompt-delivery stage: deliver the final prompt now. Do not ask questions, do not explain, add no approval gates.

${WEBSITE_RULES}
6. Keep what the person wrote — the events, the order, the feeling and any line they want said — and develop it into a 15-second piece with 3–4 timed beats (0–4s, 4–8s, 8–12s, 12–15s), one clear action per beat, grounded motion and gentle camera moves. If it is more than 15 seconds can hold, keep the main event and a clear ending; never squeeze.
7. @character is the person's cartoon character: refer to it by @character, never re-describe its face, and keep its outfit and age. When @place is given it is the environment sheet of the place: stage every shot inside that same place. The look given below is the film's whole look: name it in Style & Mood and hold it.
8. Made for a family audience: warm, safe and kind; nothing frightening, violent or romantic.`;

/**
 * Each part of a character's story written by «المخرج الخارق» (in parallel, each knowing the whole story). A part he
 * could not write gets "" and the film falls back to its own plain prompt — never blocked. Returns the prompts and how
 * many were written (only those are paid).
 */
export async function directCartoon(input: CartoonInput): Promise<{ directed: string[]; written: number }> {
  const def = generatorById(CARTOON_VIDEO)!;
  const style = CARTOON_STYLES.find((item) => item.id === input.style)!;
  const place = CARTOON_PLACES[input.place] ?? CARTOON_PLACES.garden;
  const settings = cartoonVideoSettings(input);
  const meta = [{ name: "character", kind: "image" as const, role: "reference" as const }, { name: "place", kind: "image" as const, role: "reference" as const }];
  const whole = input.scenes.map((text, i) => `Part ${i + 1} (seconds ${i * 15}–${(i + 1) * 15} of the whole film): ${text}`).join("\n");
  const directed = await Promise.all(input.scenes.map(async (text, i) => {
    const parts: ClaudePart[] = [
      { type: "text", text: settingsText(def, { ...settings }, "omni_reference", meta) },
      { type: "text", text: [
        "@character — the person's cartoon character (a picture" + (input.mode === "sheet" ? ", a full character sheet: turnaround and expressions" : ", full body on a grey background") + ").",
        "@place — the environment sheet of the place: " + place.text + ".",
        "The look: " + style.text + " Level of stylisation: " + style.real + ".",
        "Who it is for: " + AUDIENCE_RULES[input.audience],
        input.scenes.length > 1 ? "The whole story, part by part:\n" + whole + "\n\nWrite ONLY part " + (i + 1) + " of " + input.scenes.length + (i ? ", picking up exactly where part " + i + " ends" : ", ending on a moment the next part can pick up from") + "." : "",
        "What the person wrote for this part:\n<<<\n" + text + "\n>>>",
      ].filter(Boolean).join("\n") },
    ];
    try {
      const r = await directorRun(CARTOON_TASK, parts, ["character", "place"]);
      return hasArabic(r.prompt) ? "" : r.prompt;
    } catch (error) {
      console.error("cartoon director", error);
      return "";
    }
  }));
  return { directed, written: directed.filter(Boolean).length };
}

/** The film's references: the character's picture, and the place's environment sheet in the same look when it is drawn. */
export async function filmRefs(userId: string, input: CartoonInput, characterUpload: string) {
  const refs = [{ uploadId: characterUpload, role: "reference" as const, name: "character" }];
  if (input.mode !== "scene" && input.scenes?.length) {
    const bytes = await placeSheetBytes(input.place, input.style);
    if (bytes) refs.push({ uploadId: (await uploadFromBuffer(userId, bytes, `place-${input.place}.jpg`)).id, role: "reference", name: "place" });
  }
  return refs;
}

/**
 * A picture of the person's cartoon runs (any of them, old ones too) and the run it came from, to make a film of it.
 * The film reads the run's own choices (the look, the mode, who it is for) and adds the place and the story.
 */
export async function filmSource(userId: string, outputId: unknown, rawFilm: unknown) {
  const db = createAdminClient();
  const { data: out } = await db.from("jawad_outputs").select("id,job_id,kind").eq("id", String(outputId ?? "")).eq("user_id", userId).maybeSingle();
  if (!out || out.kind !== "image") throw new UserError("اختر صورة من صورك الكرتونية.", 404);
  const { data: row } = await db.from("jawad_jobs").select("*").eq("id", out.job_id).eq("user_id", userId).maybeSingle();
  const plan = row ? planOf(row as JobRow) : undefined;
  if (!plan) throw new UserError("هذه الصورة ليست من «حولني الى الستايل الكرتوني».", 400);
  const saved = plan.input;
  let film: { place: CartoonInput["place"]; scenes: string[] };
  try { film = cartoonFilm(rawFilm, saved.mode); } catch (error) { throw new UserError((error as Error).message, 400); }
  const input: CartoonInput = { ...saved, audience: saved.audience ?? "family", place: film.place, scenes: saved.mode === "scene" ? [] : film.scenes, directed: undefined, storyEn: undefined, heightCm: saved.heightCm ?? null, weightKg: saved.weightKg ?? null, count: 0, video: true };
  return { input, parent: plan.parent ?? plan.key, outputId: out.id as string };
}
