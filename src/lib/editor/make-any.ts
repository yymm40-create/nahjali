// «حيدرة» makes anything for the edit with JAWAD AI's own generators: a picture (GPT Image 2), a video (Seedance), a
// voice reading a text (Eleven v4), a sound effect, music. The plan is priced here exactly as JAWAD AI prices it
// (the owner's prices); the job is then made by JAWAD AI's job system (its checks, its coins, its refunds), the result
// lands in «أعمالي» and the page brings it into the project and places it. Server only.

import { giveAttempt, takeAttempt } from "@/lib/film/team";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatorById } from "@config/jawad/generators";
import type { Settings } from "@config/jawad/types";
import { evaluate } from "@/lib/jawad/engine";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { createJob } from "@/lib/jawad/server/jobs";
import { jobViews } from "@/lib/jawad/server/works";
import { can } from "@/lib/access";
import { listVoices } from "@/lib/jawad/server/voices";
import type { Who } from "./pricing";

const db = () => createAdminClient();

export type MakeKind = "image" | "video" | "speech" | "sfx" | "music";
export type MakePlace = "over" | "main" | "audio" | "library";
export const MAKE_KINDS: MakeKind[] = ["image", "video", "speech", "sfx", "music"];

/** The generators each kind may use, best first (the first one available is taken). */
const CHOICES: Record<MakeKind, string[]> = {
  image: ["openai-gpt-image-2"],
  video: ["byteplus-seedance-2-5", "byteplus-seedance-2-0"],
  speech: ["elevenlabs-eleven-v4", "openai-gpt-4o-mini-tts"],
  sfx: ["elevenlabs-sfx-v2"],
  music: ["elevenlabs-music-v2-5"],
};

/** What Claude asks for (from its answer). */
export interface MakeSpec {
  makeKind: MakeKind;
  prompt: string;
  /** image/video shape ("" = the project's) */
  aspect: string;
  /** video, sfx, music length */
  seconds: number;
  /** speech: a voice's name, or a description of the voice wanted */
  voice: string;
  /** video: with its own sound; music: with singing */
  withSound: boolean;
  quality: string;
  place: MakePlace;
  at: number;
  name: string;
  /** more places on the timeline for copies of the same file (a sound on every arrival of a motion piece) */
  alsoAt?: number[];
  /** the clip's volume when placed (sound; default 1) */
  volume?: number;
}

/** A priced plan the page can start (as is: the server checks it all again when it starts). */
export interface MakePlan {
  kind: MakeKind;
  generatorId: string;
  generatorName: string;
  sectionId: string;
  prompt: string;
  settings: Settings;
  coins: number;
  /** nothing is taken from the person's coins (the owner, a free guest, or a free price) */
  free: boolean;
  place: MakePlace;
  at: number;
  name: string;
  alsoAt?: number[];
  volume?: number;
}

const IMAGE_ASPECTS = ["1:1", "16:9", "9:16", "3:2", "2:3"];
const VIDEO_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const ratioNum = (r: string) => {
  const [a, b] = r.split(":").map(Number);
  return a && b ? a / b : 1;
};
/** The closest of `list` to `want` ("" → the project's shape). */
export function nearestAspect(want: string, list: string[], project: number) {
  if (list.includes(want)) return want;
  const target = /^\d+:\d+$/.test(want) ? ratioNum(want) : project;
  return list.reduce((best, r) => (Math.abs(Math.log(ratioNum(r) / target)) < Math.abs(Math.log(ratioNum(best) / target)) ? r : best), list[0]);
}

/** The settings a kind sends, from Claude's few fields (everything else stays at the generator's defaults). */
export function makeSettings(s: MakeSpec, projectRatio: number, voice: string | null): Settings {
  const secs = Math.round(Number(s.seconds) || 0);
  switch (s.makeKind) {
    case "image":
      return { aspect: nearestAspect(s.aspect, IMAGE_ASPECTS, projectRatio), quality: ["low", "medium", "high"].includes(s.quality) ? s.quality : "high", resolution: "std", count: 1 };
    case "video":
      return { ratio: nearestAspect(s.aspect, VIDEO_RATIOS, projectRatio), resolution: s.quality === "1080p" || s.quality === "480p" ? s.quality : "720p", duration: Math.min(15, Math.max(4, secs || 5)), audio: s.withSound };
    case "speech":
      return voice ? { voice } : {};
    case "sfx":
      return { duration: Math.min(30, Math.max(1, secs || 3)), loop: false };
    case "music":
      return { duration: Math.min(300, Math.max(10, Math.round((secs || 30) / 5) * 5)), instrumental: !s.withSound };
  }
}

/** A voice for the words: one of the person's own by its name, else a ready voice whose description fits best. */
async function pickVoice(who: Who, want: string): Promise<string | null> {
  const v = await listVoices(who.id, who.owner).catch(() => null);
  if (!v) return null;
  const w = want.trim().toLowerCase();
  const all = [...v.mine, ...v.ready];
  if (w) {
    const named = all.find((x) => x.name.toLowerCase() === w) ?? all.find((x) => w.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(w));
    if (named) return named.value;
    // «صوتي» / my voice: the person's newest own voice
    if (/صوتي|my voice|بصوتي/.test(w) && v.mine[0]) return v.mine[0].value;
    const words = w.split(/[\s,،·]+/).filter((x) => x.length > 2);
    const male = /رجل|ذكر|male|man|رجالي|شاب/.test(w);
    const female = /امرأة|أنثى|انثى|female|woman|بنت|نسائي/.test(w);
    const scored = v.ready
      .map((x) => {
        const d = `${x.name} ${x.description}`.toLowerCase();
        let n = words.filter((k) => d.includes(k)).length;
        if (male && /\bmale\b/.test(d) && !/female/.test(d)) n += 3;
        if (female && /female/.test(d)) n += 3;
        return { x, n };
      })
      .sort((a, b) => b.n - a.n);
    if (scored[0]?.n) return scored[0].x.value;
  }
  return null;
}

/** The person's own voices (names only), for «حيدرة» to know «بصوتي». */
export async function ownVoiceNames(userId: string) {
  const { data } = await db().from("jawad_voices").select("name").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => String(r.name));
}

/** A request priced (or why it can't be made). */
export async function planMake(who: Who & { email?: string | null }, s: MakeSpec, projectRatio: number): Promise<{ plan: MakePlan } | { error: string }> {
  if (!MAKE_KINDS.includes(s.makeKind)) return { error: "نوع غير معروف." };
  if (!s.prompt.trim()) return { error: "ما وصل وصف اللي أصنعه." };
  if (!(await can(who.email, "editor_ai"))) return { error: "حيدرة (الذكاء الاصطناعي) مقفل لحسابك الحين." };
  const rt = await loadRuntime();
  if (!rt.migrated) return { error: "منصة الجواد AI قيد التجهيز." };
  const rg = CHOICES[s.makeKind].map((id) => rt.generators.find((g) => g.id === id)).find((g) => g && (g.live || (who.owner && g.keyConfigured)));
  const def = rg ? generatorById(rg.id) : undefined;
  const section = rg ? rt.sections.find((x) => x.id === rg.sectionId && (x.enabled || who.owner)) : undefined;
  if (!rg || !def || !section) return { error: "هذا النوع من التوليد غير متاح حاليًا." };
  const voice = s.makeKind === "speech" ? await pickVoice(who, s.voice) : null;
  const prompt = s.prompt.trim().slice(0, def.prompt.max);
  const e = evaluate(def, { settings: makeSettings(s, projectRatio, voice), prompt, instructions: "", refStyle: "none", refs: [], strict: false }, rt.prices[def.id]);
  if (e.issues.length) return { error: e.issues[0].message };
  if (!e.price.ok) return { error: e.price.reason };
  const kindName = { image: "صورة", video: "فيديو", speech: "صوت", sfx: "مؤثر", music: "موسيقى" }[s.makeKind];
  return {
    plan: {
      kind: s.makeKind,
      generatorId: def.id,
      generatorName: def.name,
      sectionId: section.id,
      prompt,
      settings: e.settings,
      coins: e.price.coins,
      free: who.owner || e.price.coins === 0,
      place: (["over", "main", "audio", "library"] as const).includes(s.place) ? s.place : s.makeKind === "image" || s.makeKind === "video" ? "over" : "audio",
      at: Math.max(0, Math.round(Number(s.at) || 0)),
      alsoAt: (Array.isArray(s.alsoAt) ? s.alsoAt : []).map((x) => Math.max(0, Math.round(Number(x) || 0))).slice(0, 60),
      volume: Number.isFinite(Number(s.volume)) && Number(s.volume) > 0 ? Math.min(2, Number(s.volume)) : undefined,
      name: (s.name.trim() || `${kindName}: ${prompt.slice(0, 40)}`).slice(0, 80),
    },
  };
}

/** Starts a plan (the page's click, or straight away when it costs nothing): JAWAD AI checks and charges it. */
export async function startMake(user: { id: string; email?: string | null }, owner: boolean, b: { key?: unknown; plan?: unknown }, origin: string, team: string | null = null) {
  const p = (b.plan ?? {}) as Partial<MakePlan>;
  if (!p.generatorId || !p.sectionId || typeof p.prompt !== "string") throw new UserError("طلب غير صحيح.", 400);
  // a team member uses one of the attempts the series' owner gave them (given back if it fails)
  const series = team ? (await createAdminClient().from("film_series").select("user_id").eq("id", team).maybeSingle()).data : null;
  const took = series ? await takeAttempt(team!, series.user_id as string, user.id) : false;
  let r: Awaited<ReturnType<typeof createJob>>;
  try {
    r = await createJob(user, owner, { idempotencyKey: b.key, sectionId: p.sectionId, generatorId: p.generatorId, refStyle: "none", settings: p.settings, prompt: p.prompt, instructions: "", refs: [], expectedCoins: p.coins }, origin, { team, via: "editor" });
  } catch (e) {
    if (took) await giveAttempt(team!, user.id).catch(() => {});
    throw e;
  }
  if (took && r.kind !== "created") await giveAttempt(team!, user.id).catch(() => {});
  if (r.kind === "issues") throw new UserError(r.issues[0]?.message ?? "الطلب غير صالح.", 422);
  if (r.kind === "price_changed") throw new UserError(`تغيّر السعر إلى ${r.coins} نقدة؛ اطلبه من حيدرة مرة ثانية.`, 409);
  const [job] = await jobViews([r.job]);
  return { job };
}
