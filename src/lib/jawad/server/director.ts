// JAWAD AI · «المخرج الخارق»: rewrites the user's video prompt with the approved Super Director skill (Claude in the
// background, never shown as a chat). A fixed price in coins is taken before the call and given back if it fails.

import { randomUUID } from "crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn, type ClaudeUsage } from "@/lib/film/anthropic";
import { SUPER_DIRECTOR } from "@config/film-prompts/director";
import { DIRECTOR_PRICE_KEY, generatorById } from "@config/jawad/generators";
import type { GeneratorDef, RefKind, RefRole, RefStyle, Settings } from "@config/jawad/types";
import { DIRECTOR_LIMITS, directorProblems, directorPrompt, type DirectorOutput } from "../director";
import { evaluate } from "../engine";
import { cleanRefName, defaultRefName } from "../mentions";
import { JAWAD_BUCKET, loadRuntime } from "./runtime";
import { refsFor } from "./uploads";

import { storage } from "@/lib/storage";
const db = () => createAdminClient();
const LABEL = "JAWAD AI · المخرج الخارق";
const ROLES: RefRole[] = ["first_frame", "last_frame", "reference"];
/** Images Claude looks at (the rest of the references are described in text). */
const MAX_IMAGES = 8;

/** The website's rules for every Super Director prompt (develop or edit); they override the skill where they differ. */
const WEBSITE_RULES = `Website rules (they override the skill wherever they differ):
1. Output the final EN/ZH pair as the JSON object {"en": "...", "zh": "..."} (instead of the array), with the same content rules.
2. Length: "en" at most ${DIRECTOR_LIMITS.en} characters and "zh" at most ${DIRECTOR_LIMITS.zh} characters, each counted WITHOUT the spoken lines (rule 4). Trim in the skill's order (Narrative Summary, then Static Description, then Style & Mood) and keep the Dynamic Description.
3. The settings chosen in the website are binding. They override the user's text and the skill's defaults: model version, duration, aspect ratio, resolution, sound on/off and reference mode. State the duration naturally in both prompts.
4. Spoken lines (dialogue, voice-over, singing): any Arabic line is written in Latin letters as a faithful transliteration of the same Arabic words — the prompts must contain NO Arabic script at all. Put every spoken line inside straight double quotes "..." (the same text in "en" and "zh"); use double quotes for nothing else. Lines in other languages stay in their original language, also in double quotes. When sound is off, write no spoken lines and no Audio section.
5. References: the user's attachments have names. Refer to each one only as @name, exactly as given — these are the website's attachment labels and replace <<<image_n>>>, <<<video_n>>> and <<<audio_n>>>. Never invent a reference or a name. Images among them are attached to the message so you can see them; videos and audio are described.`;

/** «طوّر البرومبت»: the website's task, after the skill (both fixed, so the whole system prompt is cached across requests). */
const WEBSITE_TASK = `

---

## WEBSITE TASK — JAWAD AI VIDEO STUDIO (applies on top of the skill above)

You run in the background of the JAWAD AI video studio; the user never sees this exchange. They wrote a prompt for a Seedance video and asked the Super Director to develop it. This message IS the final prompt-delivery stage: deliver the final prompt now. Do not ask questions, do not explain, add no approval gates.

${WEBSITE_RULES}
6. Keep the user's story, characters, actions, camera directions and dialogue (only transliterating Arabic); improve the direction, do not change what happens.`;

/** «التعديل الذكي»: the Super Director makes a video again as a fresh generation (same ideas and references, the change built in, the old one never mentioned). */
export const EDIT_TASK = `

---

## WEBSITE TASK — JAWAD AI SMART EDIT (applies on top of the skill above)

You run in the background of the JAWAD AI video studio; the user never sees this exchange. The user already generated a video with the PREVIOUS PROMPT below and wrote what they want different (with times when they know them). Frames of that video are attached, each labelled with its time in seconds — FOR YOUR UNDERSTANDING ONLY, so you know what the user is talking about. This message IS the final prompt-delivery stage: deliver the prompt now. Do not ask questions, do not explain, add no approval gates.

The new clip is a FRESH GENERATION, not a correction of the old one. The generator never sees the old video and must never be steered by it:
- Take the ideas from the PREVIOUS PROMPT (story, characters, look, wardrobe, setting, lighting, camera language, dialogue, timing) and the same references (by their @names), and write a complete, standalone prompt that already includes the user's change as simply the way the shot IS.
- Write only what SHOULD happen, positively and concretely. Never mention the previous video, a previous attempt, a mistake, an error, a fix or a change ("again", "this time", "instead of", "unlike", "no longer", "correct the…", "avoid…", "don't…", "make sure X doesn't…"). Never describe the unwanted result, not even to forbid it: naming it brings it back. E.g. the user says "his hand went through the cup" → write "his fingers wrap firmly around the cup's handle and lift it", never "the hand doesn't pass through the cup".
- Use what you see in the frames only to understand the cause, then give the direction that naturally produces the right result (precise anatomy and contact points, simpler or slower motion, stable framing, clear spatial positions, explicit continuity).
- Do not change what the user did not ask to change.
- When the task says only a PART is being regenerated: the new clip replaces only that part and is cut in cleanly. It starts exactly at the first-frame image and ends exactly at the last-frame image, over the given duration. Describe only what happens inside that part, matching the look, motion speed and direction at both cuts, so they are invisible.

${WEBSITE_RULES}
6. Spoken lines from the previous prompt stay word for word (transliterated as in rule 4) unless the user asked to change them.`;

const SCHEMA = {
  type: "object",
  properties: { en: { type: "string" }, zh: { type: "string" } },
  required: ["en", "zh"],
  additionalProperties: false,
};

export interface DirectorBody {
  idempotencyKey?: unknown;
  sectionId?: unknown;
  generatorId?: unknown;
  refStyle?: unknown;
  settings?: unknown;
  prompt?: unknown;
  refs?: unknown;
  expectedCoins?: unknown;
}

export type DirectorResult = { kind: "done"; prompt: string; coins: number; balance: number | null } | { kind: "price_changed"; coins: number };

const KIND_EN = { image: "image", video: "video", audio: "audio" } as const;
const MODE_EN: Record<string, string> = {
  text_to_video: "text only (no references)",
  first_frame: "first frame (the video starts from the first-frame image)",
  first_last_frame: "first and last frame (the video goes from the first-frame image to the last-frame image)",
  omni_reference: "multiple references",
};

/** «المخرج الخارق»: checks, charges, asks Claude (once more if the answer breaks a rule), refunds on any failure. */
export async function improvePrompt(user: { id: string }, owner: boolean, b: DirectorBody): Promise<DirectorResult> {
  const key = String(b.idempotencyKey ?? "");
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new UserError("طلب غير صحيح.", 400);
  const def = generatorById(String(b.generatorId ?? ""));
  if (!def || def.provider.id !== "byteplus-modelark") throw new UserError("المخرج الخارق متاح في صناعة الفيديو فقط.", 400);
  const prompt = typeof b.prompt === "string" ? b.prompt : "";
  if (!prompt.trim()) throw new UserError("اكتب فكرتك في البرومبت أولًا.", 400);
  if (prompt.length > def.prompt.max) throw new UserError(`البرومبت أطول من ${def.prompt.max} حرف.`, 400);

  const rt = await loadRuntime();
  if (!rt.migrated) throw new UserError("منصة JAWAD AI قيد التجهيز (قاعدة البيانات).", 503);
  const rg = rt.generators.find((g) => g.id === def.id)!;
  if (!(rg.live || owner)) throw new UserError("هذا المولد غير متاح حاليًا.", 403);
  const centi = rt.prices[def.id]?.[DIRECTOR_PRICE_KEY];
  if (centi == null) throw new UserError("المخرج الخارق غير متاح حاليًا.", 403);
  const coins = Math.ceil(centi / 100);
  if (Number(b.expectedCoins) !== coins) return { kind: "price_changed", coins };
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("المخرج الخارق غير متاح حاليًا.", 503);

  // The request: the same settings and references the video would be made with
  const refStyle: RefStyle = b.refStyle === "frames" || b.refStyle === "references" ? b.refStyle : "none";
  const rawRefs = Array.isArray(b.refs) ? b.refs.slice(0, 60) : [];
  const wanted = rawRefs.map((r) => {
    const x = (r ?? {}) as { uploadId?: unknown; role?: unknown; name?: unknown };
    const role = refStyle === "frames" && ROLES.includes(x.role as RefRole) ? (x.role as RefRole) : "reference";
    return { uploadId: String(x.uploadId ?? ""), role, name: cleanRefName(x.name) };
  });
  if (refStyle === "frames") wanted.sort((a, b2) => ROLES.indexOf(a.role) - ROLES.indexOf(b2.role));
  const found = await refsFor(user.id, wanted);
  const given = wanted.flatMap((w) => (w.name ? [w.name] : []));
  const meta = found.meta.map((m, i) => {
    const name = wanted[i].name ?? defaultRefName(m.kind, given);
    if (!wanted[i].name) given.push(name);
    return { ...m, name };
  });
  const settings = (b.settings && typeof b.settings === "object" ? b.settings : {}) as Settings;
  const e = evaluate(def, { settings, prompt, instructions: "", refStyle, refs: meta }, rt.prices[def.id]);
  const s = e.settings;

  // Charge first (the owner isn't charged). Only the first charge of the same click goes on (double click, retry).
  const charged = !owner && coins > 0;
  const ref = `director:${key}:${randomUUID()}`;
  let balance: number | null = null;
  if (charged) {
    const { data, error } = await db().rpc("adjust_smart_coins", { p_user: user.id, p_delta: -coins, p_reason: "reserve", p_ref: ref, p_label: LABEL, p_allow_negative: false });
    if (error) throw error;
    if (data == null) throw new UserError(`رصيدك من النقود الذكية لا يكفي: تطوير البرومبت يحتاج ${coins} نقدة.`, 402);
    balance = data as number;
    const { data: same } = await db().from("smart_coin_ledger").select("ref,created_at").eq("user_id", user.id).like("ref", `director:${key}:%`).lt("delta", 0).order("created_at").order("ref");
    if (same?.[0]?.ref !== ref) {
      balance = await refund(user.id, coins, ref);
      throw new UserError("هذا الطلب قيد التنفيذ بالفعل.", 409);
    }
  }

  try {
    const names = meta.map((m) => m.name);
    const parts: ClaudePart[] = [{ type: "text", text: settingsText(def, s, e.mode.id, meta) }];
    // The pictures themselves, by short-lived link, each introduced by its name
    const images = found.rows.map((r, i) => ({ r, name: meta[i].name })).filter((x) => x.r.kind === "image").slice(0, MAX_IMAGES);
    if (images.length) {
      const signed = (await storage.from(JAWAD_BUCKET).createSignedUrls(images.map((x) => x.r.storage_path), 600)).data ?? [];
      images.forEach((x, i) => {
        const url = signed[i]?.signedUrl;
        if (url) parts.push({ type: "text", text: `@${x.name}:` }, { type: "image", url });
      });
    }
    parts.push({ type: "text", text: `The user's prompt:\n<<<\n${prompt}\n>>>` });

    const r = await directorRun(WEBSITE_TASK, parts, names);
    console.info("jawad director", { user: user.id, generator: def.id, attempts: r.attempts, usd: Number(r.usd.toFixed(4)) });
    return { kind: "done", prompt: r.prompt, coins: charged ? coins : 0, balance };
  } catch (err) {
    console.error("jawad director failed", user.id, err);
    if (charged) await refund(user.id, coins, ref);
    if (err instanceof UserError) throw err;
    throw new UserError(`تعذّر تطوير البرومبت الآن؛ جرّب مرة ثانية.${charged ? ` أعدنا لك ${coins} نقدة.` : ""}`, 502);
  }
}

/** The binding settings and the named references, as Claude reads them. */
export function settingsText(def: GeneratorDef, s: Settings, modeId: string, meta: { name: string; kind: RefKind; role: RefRole; durationMs?: number | null }[]) {
  return [
    "Settings (binding):",
    `- Model: ${def.name} (${def.model.id})`,
    `- Duration: ${s.duration} seconds`,
    `- Aspect ratio: ${s.ratio === "adaptive" ? "follows the first-frame image" : s.ratio}`,
    `- Resolution: ${s.resolution}`,
    `- Sound: ${s.audio ? "on (the model generates synchronized sound)" : "off (a silent video)"}`,
    `- Reference mode: ${MODE_EN[modeId] ?? modeId}`,
    "",
    meta.length ? "References (in the order they are sent):" : "References: none.",
    ...meta.map((m) => `- @${m.name} — ${KIND_EN[m.kind]}${m.role !== "reference" ? ` (${m.role === "first_frame" ? "first frame" : "last frame"})` : ""}${m.durationMs ? `, ${(m.durationMs / 1000).toFixed(1)} s` : ""}`),
  ].join("\n");
}

/**
 * Asks the Super Director (the skill + a website task) for an EN/ZH prompt, once more if the answer breaks a
 * website rule. Throws when it fails twice.
 */
export async function directorRun(task: string, parts: ClaudePart[], names: string[]): Promise<{ prompt: string; usd: number; attempts: number }> {
  let turns: ClaudeTurn[] = [{ role: "user", content: parts }];
  const usage: ClaudeUsage[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const r = await callClaudeJson<DirectorOutput>({ system: SUPER_DIRECTOR + task, turns, schema: SCHEMA, maxTokens: 16000 });
    usage.push(r.usage);
    const problems = directorProblems(r.data, names);
    if (!problems.length) return { prompt: directorPrompt(r.data), usd: usage.reduce((t, u) => t + claudeCost(u), 0), attempts: attempt };
    // Once more, with what to fix
    turns = [...turns, { role: "assistant", content: r.raw }, { role: "user", content: `Fix these and return the complete JSON again:\n- ${problems.join("\n- ")}` }];
  }
  throw new Error("director answer broke the website rules twice");
}

async function refund(userId: string, coins: number, ref: string) {
  const { data } = await db().rpc("adjust_smart_coins", { p_user: userId, p_delta: coins, p_reason: "refund", p_ref: ref, p_label: LABEL, p_allow_negative: true });
  return (data as number | null) ?? null;
}
