// «حيدرا ماكس» makes anything for the edit with JAWAD AI's own generators: a picture (GPT Image 2), a video (Seedance), a
// voice reading a text (Eleven v4), a sound effect, music. The plan is priced here exactly as JAWAD AI prices it
// (the owner's prices); the job is then made by JAWAD AI's job system (its checks, its coins, its refunds), the result
// lands in «أعمالي» and the page brings it into the project and places it. Server only.

import { coinStr } from "@config/coins";
import type { Fit } from "./motion-build";
import { giveAttempt, takeAttempt } from "@/lib/film/team";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatorById } from "@config/jawad/generators";
import type { RefRole, Settings } from "@config/jawad/types";
import { evaluate } from "@/lib/jawad/engine";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { createJob } from "@/lib/jawad/server/jobs";
import { jobViews } from "@/lib/jawad/server/works";
import { can } from "@/lib/access";
import { listVoices } from "@/lib/jawad/server/voices";
import { refsFor, uploadFromBuffer } from "@/lib/jawad/server/uploads";
import type { Who } from "./pricing";

const db = () => createAdminClient();

export type MakeKind = "image" | "video" | "speech" | "sfx" | "music";
export type MakePlace = "over" | "main" | "audio" | "library";
export const MAKE_KINDS: MakeKind[] = ["image", "video", "speech", "sfx", "music"];

/** The generators each kind may use, best first (the first one available is taken). */
const CHOICES: Record<MakeKind, string[]> = {
  image: ["openai-gpt-image-2"],
  video: ["byteplus-seedance-2-5", "byteplus-seedance-2-0"],
  speech: ["elevenlabs-eleven-v4", "minimax-speech-2-8", "openai-gpt-4o-mini-tts", "jawad-voice"],
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
  /** a motion piece's narration: where its beats sit, so the page can stretch them to the recording's real length */
  fit?: Fit;
  refStyle?: "none" | "frames" | "references";
  refs?: { uploadId: string; role: RefRole }[];
  /** Seedance continuation: where the finished clip belongs. */
  extend?: { clipId: string; edge: "start" | "end" };
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

/** The speech providers by generator (a voice is spoken only where it lives). */
const SPEECH_GEN: Record<string, string> = { jawad: "jawad-voice", elevenlabs: "elevenlabs-eleven-v4", minimax: "minimax-speech-2-8", openai: "openai-gpt-4o-mini-tts" };
/** «openai: calm male» / «minimax: …»: the provider حيدرا ماكس asked for, and the rest of the words. */
export function speechWish(voice: string): { provider: "jawad" | "elevenlabs" | "minimax" | "openai" | null; want: string } {
  const m = /^\s*(jawad|openai|minimax|elevenlabs|eleven)\s*[:：]\s*/i.exec(voice);
  if (!m) return { provider: null, want: voice };
  const k = m[1].toLowerCase();
  return { provider: k === "eleven" ? "elevenlabs" : (k as "jawad" | "openai" | "minimax" | "elevenlabs"), want: voice.slice(m[0].length) };
}

/** A voice for the words: one of the person's own by its name, else a ready voice whose description fits best. */
async function pickVoice(who: Who, wanted: string): Promise<{ value: string; provider: string } | null> {
  const { provider, want } = speechWish(wanted);
  // OpenAI's voices are the generator's own (its default fits Arabic); nothing to pick from the library
  if (provider === "openai") return null;
  const v = await listVoices(who.id, who.owner).catch(() => null);
  if (!v) return null;
  const w = want.trim().toLowerCase();
  const all = [...v.mine, ...v.ready].filter((x) => !provider || x.provider === provider);
  const pick = (x: { value: string; provider: string }) => ({ value: x.value, provider: x.provider });
  if (w) {
    const named = all.find((x) => x.name.toLowerCase() === w) ?? all.find((x) => w.includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(w));
    if (named) return pick(named);
    // «صوتي» / my voice: the person's newest own voice
    const mine = v.mine.filter((x) => !provider || x.provider === provider);
    if (/صوتي|my voice|بصوتي|بصمتي/.test(w) && mine[0]) return pick(mine[0]);
    const words = w.split(/[\s,،·]+/).filter((x) => x.length > 2);
    const male = /رجل|ذكر|male|man|رجالي|شاب/.test(w);
    const female = /امرأة|أنثى|انثى|female|woman|بنت|نسائي/.test(w);
    const scored = v.ready
      .filter((x) => !provider || x.provider === provider)
      .map((x) => {
        const d = `${x.name} ${x.description}`.toLowerCase();
        let n = words.filter((k) => d.includes(k)).length;
        if (male && /\bmale\b/.test(d) && !/female/.test(d)) n += 3;
        if (female && /female/.test(d)) n += 3;
        return { x, n };
      })
      .sort((a, b) => b.n - a.n);
    if (scored[0]?.n) return pick(scored[0].x);
  }
  return null;
}

/** The person's own voices (names only), for «حيدرا ماكس» to know «بصوتي». */
export async function ownVoiceNames(userId: string) {
  const { data } = await db().from("jawad_voices").select("name").eq("user_id", userId).order("created_at", { ascending: false }).limit(20);
  return (data ?? []).map((r) => String(r.name));
}

/** A request priced (or why it can't be made). */
export async function planMake(who: Who & { email?: string | null }, s: MakeSpec, projectRatio: number): Promise<{ plan: MakePlan } | { error: string }> {
  if (!MAKE_KINDS.includes(s.makeKind)) return { error: "نوع غير معروف." };
  if (!s.prompt.trim()) return { error: "ما وصل وصف اللي أصنعه." };
  if (!(await can(who.email, "editor_ai"))) return { error: "حيدرا ماكس (الذكاء الاصطناعي) مقفل لحسابك الحين." };
  const rt = await loadRuntime();
  if (!rt.migrated) return { error: "منصة الجواد AI قيد التجهيز." };
  // speech: the voice's own provider first (a library voice lives at one), else the provider asked for; then the
  // first generator that can take the request as it is (JAWAD's own engine speaks only with a voiceprint, so without
  // one the next generator takes it)
  const voicePick = s.makeKind === "speech" ? await pickVoice(who, s.voice) : null;
  const asked = s.makeKind === "speech" ? speechWish(s.voice).provider : null;
  const first = voicePick ? SPEECH_GEN[voicePick.provider] : asked ? SPEECH_GEN[asked] : null;
  const order = first ? [first, ...CHOICES[s.makeKind].filter((id) => id !== first)] : CHOICES[s.makeKind];
  let picked: { rg: (typeof rt.generators)[number]; def: NonNullable<ReturnType<typeof generatorById>>; section: (typeof rt.sections)[number]; e: ReturnType<typeof evaluate> & { price: { ok: true; coins: number } }; prompt: string } | null = null;
  let why = "هذا النوع من التوليد غير متاح حاليًا.";
  for (const id of order) {
    const rg = rt.generators.find((g) => g.id === id);
    const def = rg ? generatorById(rg.id) : undefined;
    const section = rg ? rt.sections.find((x) => x.id === rg.sectionId && (x.enabled || who.owner)) : undefined;
    if (!rg || !def || !section || !(rg.live || (who.owner && rg.keyConfigured))) continue;
    // a library voice only goes to the generator it lives at (another one speaks with its own default voice)
    const voice = voicePick && SPEECH_GEN[voicePick.provider] === rg.id ? voicePick.value : null;
    const prompt = s.prompt.trim().slice(0, def.prompt.max);
    const e = evaluate(def, { settings: makeSettings(s, projectRatio, voice), prompt, instructions: "", refStyle: "none", refs: [], strict: false }, rt.prices[def.id]);
    if (e.issues.length) {
      why = e.issues[0].message;
      continue;
    }
    if (!e.price.ok) {
      why = e.price.reason;
      continue;
    }
    picked = { rg, def, section, e: e as typeof e & { price: { ok: true; coins: number } }, prompt };
    break;
  }
  if (!picked) return { error: why };
  const { def, section, e, prompt } = picked;
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

/** Prices a beginning/end continuation using Seedance only and the selected clip's exact boundary frame. */
export async function planSeedanceExtend(
  who: Who & { email?: string | null },
  b: { clipId?: unknown; edge?: unknown; frame?: unknown; seconds?: unknown; prompt?: unknown; quality?: unknown; withSound?: unknown },
): Promise<{ plan: MakePlan }> {
  if (!(await can(who.email, "editor_ai"))) throw new UserError("حيدرا ماكس (الذكاء الاصطناعي) مقفل لحسابك الحين.", 403);
  const clipId = String(b.clipId ?? "");
  const edge = b.edge === "start" ? "start" : b.edge === "end" ? "end" : null;
  if (!clipId || !edge) throw new UserError("اختر المقطع وجهة التمديد.", 400);
  const raw = String(b.frame ?? "").replace(/^data:image\/(?:jpeg|jpg);base64,/, "");
  if (!raw || raw.length > 8_000_000 || !/^[A-Za-z0-9+/=]+$/.test(raw)) throw new UserError("تعذّر تجهيز فريم الربط؛ جرّب مرة ثانية.", 400);
  const bytes = new Uint8Array(Buffer.from(raw, "base64"));
  if (bytes.length < 1000) throw new UserError("فريم الربط غير صالح.", 400);
  const role: RefRole = edge === "end" ? "first_frame" : "last_frame";
  const upload = await uploadFromBuffer(who.id, bytes, `seedance-extend-${edge}.jpg`);
  const refs = [{ uploadId: upload.id, role }];
  const meta = (await refsFor(who.id, refs)).meta;
  const rt = await loadRuntime();
  if (!rt.migrated) throw new UserError("منصة الجواد AI قيد التجهيز.", 503);
  const seconds = Math.min(15, Math.max(4, Math.round(Number(b.seconds) || 5)));
  const quality = b.quality === "1080p" || b.quality === "480p" ? b.quality : "720p";
  const wish = String(b.prompt ?? "").trim().slice(0, 4000);
  const continuity =
    edge === "end"
      ? "هذا تمديد لنهاية لقطة موجودة. ابدأ حرفيًا من الإطار الأول المرفق، وثبّت الهوية والمكان والإضاءة واتجاه الحركة والعدسة، ثم أكمل الحركة طبيعيًا بلا قفزة أو إعادة للمشهد."
      : "هذا تمديد لبداية لقطة موجودة. اصنع الأحداث السابقة زمنيًا، وانتهِ حرفيًا عند الإطار الأخير المرفق بنفس الهوية والمكان والإضاءة واتجاه الحركة والعدسة، ليكون القطع إلى المقطع الأصلي غير مرئي.";
  const prompt = `${continuity}${wish ? `\nالمطلوب الإبداعي: ${wish}` : "\nأكمل الفعل المرئي الأقرب منطقيًا من دون إضافة عناصر أو شخصيات جديدة."}`;
  let reason = "Seedance غير متاح حاليًا.";
  for (const id of CHOICES.video) {
    const rg = rt.generators.find((generator) => generator.id === id);
    const def = rg ? generatorById(rg.id) : undefined;
    const section = rg ? rt.sections.find((item) => item.id === rg.sectionId && (item.enabled || who.owner)) : undefined;
    if (!rg || !def || !section || !(rg.live || (who.owner && rg.keyConfigured))) continue;
    const e = evaluate(def, { settings: { ratio: "16:9", resolution: quality, duration: seconds, audio: b.withSound !== false }, prompt, instructions: "", refStyle: "frames", refs: meta, strict: false }, rt.prices[def.id]);
    if (e.issues.length) {
      reason = e.issues[0].message;
      continue;
    }
    if (!e.price.ok) {
      reason = e.price.reason;
      continue;
    }
    return {
      plan: {
        kind: "video",
        generatorId: def.id,
        generatorName: def.name,
        sectionId: section.id,
        prompt: prompt.slice(0, def.prompt.max),
        settings: e.settings,
        coins: e.price.coins,
        free: who.owner || e.price.coins === 0,
        place: "library",
        at: 0,
        name: edge === "start" ? "تمديد بداية المقطع" : "تمديد نهاية المقطع",
        refStyle: "frames",
        refs,
        extend: { clipId, edge },
      },
    };
  }
  throw new UserError(reason, 422);
}

/** Starts a plan (the page's click, or straight away when it costs nothing): JAWAD AI checks and charges it. */
export async function startMake(user: { id: string; email?: string | null }, owner: boolean, b: { key?: unknown; plan?: unknown }, origin: string, team: string | null = null) {
  const p = (b.plan ?? {}) as Partial<MakePlan>;
  if (!p.generatorId || !p.sectionId || typeof p.prompt !== "string") throw new UserError("طلب غير صحيح.", 400);
  const refStyle = p.refStyle === "frames" || p.refStyle === "references" ? p.refStyle : "none";
  const refs = Array.isArray(p.refs) ? p.refs.slice(0, 30) : [];
  if (p.extend && (!p.generatorId.startsWith("byteplus-seedance-") || refStyle !== "frames" || refs.length !== 1)) throw new UserError("AI Extend يعمل مع Seedance فقط.", 400);
  // a team member uses one of the attempts the series' owner gave them (given back if it fails)
  const series = team ? (await createAdminClient().from("film_series").select("user_id").eq("id", team).maybeSingle()).data : null;
  const took = series ? await takeAttempt(team!, series.user_id as string, user.id) : false;
  let r: Awaited<ReturnType<typeof createJob>>;
  try {
    r = await createJob(user, owner, { idempotencyKey: b.key, sectionId: p.sectionId, generatorId: p.generatorId, refStyle, settings: p.settings, prompt: p.prompt, instructions: "", refs, expectedCoins: p.coins }, origin, { team, via: "editor" });
  } catch (e) {
    if (took) await giveAttempt(team!, user.id).catch(() => {});
    throw e;
  }
  if (took && r.kind !== "created") await giveAttempt(team!, user.id).catch(() => {});
  if (r.kind === "issues") throw new UserError(r.issues[0]?.message ?? "الطلب غير صالح.", 422);
  if (r.kind === "price_changed") throw new UserError(`تغيّر السعر إلى ${coinStr(r.coins)}؛ اطلبه من حيدرا ماكس مرة ثانية.`, 409);
  const [job] = await jobViews([r.job]);
  return { job };
}
