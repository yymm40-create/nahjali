// «من فكرة لمسودة» — the server's part (server only). `draft_quote`: the planning's price and each route's estimated
// total for the chosen length, voice and music (before anything runs), the person's own voices and «هويتي».
// `draft_plan`: «حيدرا ماكس» (Claude Sonnet) writes the plan at its own price, asked first and given back if it fails.
// `draft_price`: the edited plan priced part by part exactly as JAWAD AI prices each generator (the total is their
// sum). `draft_start`: parts started as ordinary JAWAD AI jobs (their checks, coins and refunds), a few at a time —
// the page keeps the queue, because JAWAD AI lets only a few jobs run at once.

import { coinStr } from "@config/coins";
import { findStyle } from "@config/film-styles";
import { brandBrief, brandIsEmpty } from "@config/jawad/taste";
import { UserError } from "@/lib/api";
import { callClaudeJson } from "@/lib/film/anthropic";
import { withClaude } from "@/lib/film/claude-model";
import { brandKitFor } from "@/lib/jawad/server/taste";
import { listVoices } from "@/lib/jawad/server/voices";
import { RATIOS } from "./model";
import { planMake, startMake, type MakeCache, type MakePlan } from "./make-any";
import { charged, priceOf, type Who } from "./pricing";
import { stillOpen, type EditorProject } from "./server";
import {
  DRAFT_LIMITS,
  DRAFT_ROUTES,
  DRAFT_SCHEMA,
  draftParts,
  draftTotal,
  fitDurations,
  hasVoice,
  partSpec,
  planIssues,
  readOptions,
  readPlan,
  ROUTE_ORDER,
  samplePlan,
  sceneRange,
  suggestedScenes,
  type DraftOptions,
  type DraftPlan,
  type DraftRoute,
  type PricedPart,
} from "./draft";

// the same for every call (cached): the length, the route, the language, the style and «هويتي» are in the turn's note
const SYSTEM = `You are «حيدرا ماكس», the assistant of an Arabic video editor, writing the plan of a short video (a reel, a short explainer, an ad) from the person's idea — or from their full script.
Write the plan as scenes. Each scene has:
- "narration": what the voice-over says in that scene, in the video's language. Natural spoken sentences, short and clear; the first scene is a hook that stops the scroll (a question, a surprising fact, a bold promise), the last one closes with a clear ending or a call to action. When the person gave a full script, keep THEIR words: split them into scenes in order, without rewriting, adding or dropping sentences.
- "onScreen": 2–6 words shown big on screen — the scene's key idea, never the whole sentence.
- "visual": what is seen, in detailed English for an image or video generator — subject, action, setting, light, lens and camera move; one consistent look across the scenes (the same characters described the same way every time). Never ask for writing, letters, captions or logos in the picture. Empty for the motion-only route.
- "seconds": the scene's length; about 2.3 spoken Arabic words (2.6 English) per second of narration, plus a breath.
- "motion" and "points": only for the motion-only route (see the schema); else "title" and [].
The visuals must be safe and modest: no realistic adult women and no girls (prefer objects, places, hands at work, nature, animals, men or boys in modern everyday clothes, or stylised characters); no traditional Gulf dress or thobes and nothing themed on the Gulf; no violence or anything frightening; no real brands, famous people or protected characters.
Religious phrases keep their full form («صلى الله عليه وآله», never ﷺ); a saying or story of the Imams is told as narrated («روي عن…»), never stated as certain fact.
Also give the video a short "title" and describe the background "music" (instrumental, English).`;

const ratioNum = (o: Pick<DraftOptions, "ratio">) => RATIOS[o.ratio].width / RATIOS[o.ratio].height;

/** Each part of a plan priced as JAWAD AI prices it (the same request priced once; `only`: just these parts). */
async function pricePlan(who: Who, plan: DraftPlan, o: DraftOptions, cache: MakeCache, only?: Set<string>) {
  const memo = new Map<string, Promise<{ plan: MakePlan } | { error: string }>>();
  const out: (PricedPart & { plan?: MakePlan })[] = [];
  for (const part of draftParts(plan, o)) {
    if (only && !only.has(part.key)) continue;
    const spec = partSpec(part, plan, o);
    const k = JSON.stringify({ ...spec, name: "" });
    if (!memo.has(k)) memo.set(k, planMake(who, spec, ratioNum(o), cache));
    const r = await memo.get(k)!;
    if ("error" in r) out.push({ ...part, coins: 0, error: r.error });
    // (a priced request is shared by identical parts; each keeps its own name)
    else out.push({ ...part, coins: r.plan.coins, plan: { ...r.plan, name: spec.name } });
  }
  return { parts: out, total: draftTotal(out), error: out.find((x) => x.error)?.error ?? null };
}

const publicParts = (parts: (PricedPart & { plan?: MakePlan })[]) => parts.map(({ key, kind, scene, coins, error }) => ({ key, kind, scene, coins, error: error ?? null }));

async function brandOf(who: Who) {
  const kit = await brandKitFor(who.id).catch(() => null);
  return kit && !brandIsEmpty(kit) ? kit : null;
}

/** `{ seconds, ratio, lang, voice, music }` → the planning's price, each route's estimated total, own voices, the brand. */
export async function draftQuote(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const o = readOptions(b);
  const cache: MakeCache = {};
  const { coins: planCoins } = await priceOf(who, "editor_price_draft", 1);
  const routes = {} as Record<DraftRoute, { coins: number; scenes: number; error: string | null }>;
  for (const route of ROUTE_ORDER) {
    const r = await pricePlan(who, samplePlan(o.seconds, route, o.lang), { ...o, route }, cache);
    routes[route] = { coins: r.total, scenes: suggestedScenes(o.seconds, route), error: r.error };
  }
  const v = await (cache.voices ??= listVoices(who.id, who.owner).catch(() => null));
  const kit = await brandOf(who);
  return { planCoins, routes, voices: (v?.mine ?? []).map((x) => x.name).slice(0, 30), brand: kit ? { colors: kit.colors, fonts: kit.fonts } : null };
}

/** `{ idea, …options, expectedCoins }` → «حيدرا ماكس»'s plan (its price taken only when a usable plan came back). */
export async function draftPlan(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const o = readOptions(b);
  const idea = String(b.idea ?? "").trim().slice(0, DRAFT_LIMITS.idea);
  if (idea.length < 3) throw new UserError("اكتب فكرتك أو السكربت أول.", 400);
  const { coins } = await priceOf(who, "editor_price_draft", 1);
  const agreed = Number(b.expectedCoins);
  if (!Number.isFinite(agreed) || coins > agreed) throw new UserError(`السعر صار ${coinStr(coins)}. أكّد المبلغ الجديد.`, 409, { code: "price_changed", coins });
  const style = o.styleId ? findStyle(o.styleId) : undefined;
  const kit = await brandOf(who);
  const { min, max } = sceneRange(o.seconds, o.route);
  const r = DRAFT_ROUTES[o.route];
  const note = [
    `The video is ${o.seconds} seconds long, ${o.ratio === "16:9" ? "horizontal (16:9)" : o.ratio === "9:16" ? "vertical (9:16)" : `shaped ${o.ratio}`}. Write ${suggestedScenes(o.seconds, o.route)} scenes (between ${min} and ${max}), each ${r.minSec}–${r.maxSec} seconds, the lengths adding up to ${o.seconds} seconds.`,
    `The video's language: ${o.lang === "en" ? "English" : "plain, simple Arabic (Gulf-friendly, no hard words)"} — the narration, the words on screen and the title.`,
    o.route === "motion"
      ? `Route: motion-only — every scene is drawn in code (a heading, a phrase with one stressed word, a list of up to 3 short points, or a big number counting up). Leave "visual" empty; choose "motion" (and "points" for a list) to fit each scene; a number in the scene suits "big".`
      : o.route === "video"
        ? "Route: generated video — each scene's visual is ONE continuous shot a video generator makes (a clear subject and one simple action, a smooth camera move)."
        : "Route: pictures moved in code — each scene's visual is ONE still picture (a strong composition that still reads with a slow zoom or drift over it).",
    hasVoice(o) ? "There is a voice-over: every scene has narration." : "There is NO voice-over: the narration is shown as captions only, so keep it very short.",
    style ? `The visual style (keep every visual in it): ${style.name} — ${style.description}` : "",
    kit ? `${brandBrief(kit)}\n(Use the brand's tone in the words; its colours may appear in the visuals.)` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const plan = await charged(who, "editor_price_draft", 1, "خطة «من فكرة لمسودة» في حيدرة كت", async () => {
    const res = await withClaude("claude-sonnet-5-5", () =>
      callClaudeJson<unknown>({ system: SYSTEM, turns: [{ role: "user", content: idea }], turnNote: note, schema: DRAFT_SCHEMA, maxTokens: 8000, effort: "low", fallback: true, cacheTail: false }),
    ).catch((e) => {
      console.error("editor draft plan", e);
      throw new UserError("ما قدر حيدرا ماكس يكتب الخطة الحين؛ ما انخصم منك شي. جرّب بعد شوي.", 502);
    });
    const read = readPlan(res.data);
    if (!read.scenes.length) throw new UserError("ما طلعت خطة صالحة؛ ما انخصم منك شي. اكتب الفكرة بوضوح أكثر وجرّب.", 422);
    return fitDurations({ ...read, scenes: read.scenes.slice(0, max) }, o.seconds, o.route);
  });
  return { plan, coins };
}

/** `{ plan, …options }` → each part's price, the total (their sum) and what still stops the plan. */
export async function draftPrice(p: EditorProject, who: Who, b: Record<string, unknown>) {
  stillOpen(p);
  const o = readOptions(b);
  const plan = readPlan(b.plan);
  const r = await pricePlan(who, plan, o, {});
  return { parts: publicParts(r.parts), total: r.total, issues: planIssues(plan, o), error: r.error };
}

/**
 * `{ plan, …options, run, only: [part keys], attempt, expectedCoins }` → each part started as a JAWAD AI job, or why
 * not (a 429 «busy» is left for the page to try again). The price agreed is checked again: a higher one is asked.
 */
export async function draftStart(p: EditorProject, who: Who, user: { id: string; email?: string | null }, owner: boolean, b: Record<string, unknown>, origin: string, team: string | null) {
  stillOpen(p);
  const o = readOptions(b);
  const plan = readPlan(b.plan);
  const issues = planIssues(plan, o);
  if (issues.length) throw new UserError(issues[0], 400);
  const run = String(b.run ?? "");
  if (!/^[A-Za-z0-9]{6,30}$/.test(run)) throw new UserError("طلب غير صحيح.", 400);
  const only = new Set((Array.isArray(b.only) ? b.only : []).map(String).filter((k) => /^(m|[vs]\d{1,2})$/.test(k)).slice(0, 40));
  if (!only.size) throw new UserError("ما فيه شي يبدأ.", 400);
  const attempt = Math.min(99, Math.max(0, Math.round(Number(b.attempt) || 0)));
  const priced = await pricePlan(who, plan, o, {}, only);
  const bad = priced.parts.find((x) => x.error || !x.plan);
  if (bad) throw new UserError(bad.error ?? "هذا الجزء ما ينصنع الحين.", 422);
  const agreed = Number(b.expectedCoins);
  if (!Number.isFinite(agreed) || priced.total > agreed) throw new UserError(`السعر صار ${coinStr(priced.total)}. أكّد المبلغ الجديد.`, 409, { code: "price_changed", coins: priced.total });
  const style = o.styleId ? findStyle(o.styleId) : undefined;
  const brand = !!(await brandOf(who));
  const out: { key: string; job?: Awaited<ReturnType<typeof startMake>>["job"]; error?: string; busy?: boolean }[] = [];
  for (const part of priced.parts) {
    const visual = part.kind === "image" || part.kind === "video";
    try {
      const { job } = await startMake(user, owner, { key: `dr-${run}-${part.key}-${attempt}`, plan: { ...part.plan!, ...(visual && style ? { styleId: style.id } : {}), ...(visual && brand ? { brand: true } : {}) } }, origin, team);
      out.push({ key: part.key, job });
    } catch (e) {
      const ue = e instanceof UserError ? e : null;
      if (!ue) console.error("editor draft start", e);
      out.push({ key: part.key, error: ue?.message ?? "تعذّر بدء هذا الجزء.", busy: ue?.status === 429 });
    }
  }
  return { parts: out };
}
