// «الجواد الذكي!» | JAWAD AI — «جواد», the studio's chat assistant (Claude). Shared by the studio and the server. Pure.
//
//   The person talks to Jawad inside a studio (images, video or audio). Jawad knows the section's generators (from the
//   registry, so it never goes stale), asks what it needs, then FILLS THE FORM: the generator, the prompt, the options
//   and the references. It never generates: the person reads what it put in and presses «توليد» themselves.
//   Everything Claude returns is checked here against the registry before it touches the form.

import type { GeneratorDef, OptionDef, RefRole, RefStyle, Settings, SettingValue } from "./types";
import { playbooksBrief } from "./playbooks";

export const ASSISTANT_NAME = "جواد";
export const ASSISTANT_LIMITS = { message: 3000, history: 14, attachments: 4, images: 8, refs: 20 } as const;
export const THUMBNAIL_SIDES = ["left", "right", "center"] as const;
export type ThumbnailSide = (typeof THUMBNAIL_SIDES)[number];

/** A reference as the assistant sees it (and as the form holds it). */
export interface AssistantRef {
  uploadId: string;
  name: string;
  kind: "image" | "video" | "audio";
  role: RefRole;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
}

/** What the form holds now, sent with each message. */
export interface AssistantDraft {
  generatorId: string;
  prompt: string;
  instructions: string;
  settings: Settings;
  refStyle: RefStyle;
  refs: AssistantRef[];
}

/** What Claude is asked to return (every field present; an empty string / array means «no change»). */
export interface AssistantRaw {
  reply: string;
  generatorId: string;
  prompt: string;
  instructions: string;
  settings: { key: string; value: string }[];
  refStyle: string;
  addRefs: { source: string; id: string; name: string; role: string }[];
  removeRefs: string[];
  thumbnailPerson: string;
  thumbnailSide: string;
  quick: string[];
}

export const ASSISTANT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "generatorId", "prompt", "instructions", "settings", "refStyle", "addRefs", "removeRefs", "thumbnailPerson", "thumbnailSide", "quick"],
  properties: {
    reply: { type: "string" },
    generatorId: { type: "string" },
    prompt: { type: "string" },
    instructions: { type: "string" },
    settings: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } } },
    refStyle: { type: "string" },
    addRefs: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["source", "id", "name", "role"], properties: { source: { type: "string" }, id: { type: "string" }, name: { type: "string" }, role: { type: "string" } } },
    },
    removeRefs: { type: "array", items: { type: "string" } },
    thumbnailPerson: { type: "string" },
    thumbnailSide: { type: "string" },
    quick: { type: "array", items: { type: "string" } },
  },
};

/** What the form is told to do, after the checks. */
export interface AssistantSet {
  generatorId?: string;
  prompt?: string;
  instructions?: string;
  settings?: Settings;
  refStyle?: RefStyle;
  /** New references: an attachment of this message (by its number) or a work already in the form (by name). */
  addRefs?: { attachment: number; name: string; role: RefRole }[];
  /** Existing references given a new name or role. */
  editRefs?: { name: string; newName?: string; role?: RefRole }[];
  removeRefs?: string[];
  /** The thumbnail maker: which reference is the person, and on which side they stand. */
  thumbnail?: { person: string; side: ThumbnailSide };
}

export interface AssistantAnswer {
  reply: string;
  set: AssistantSet;
  quick: string[];
  /** A prompt Claude wrote that would draw a real woman: refused here, never put in the form. */
  blocked?: "women";
}

// ───────────────────────────── what each generator is, in words ─────────────────────────────

const optionBrief = (o: OptionDef) => {
  if (o.kind === "choice") {
    const vals = o.values.map((v) => `${v.value}${v.label && v.label !== v.value ? ` (${v.label})` : ""}`).join(" | ");
    return `  - ${o.key} («${o.label}»): ${vals}${o.accepts ? " | or an id the person picks in the voice picker (never invent one)" : ""}; default ${o.default}`;
  }
  if (o.kind === "int") return `  - ${o.key} («${o.label}»): whole number ${o.min}–${o.max}${o.unit ? ` ${o.unit}` : ""}; default ${o.default}`;
  return `  - ${o.key} («${o.label}»): true | false; default ${o.default}`;
};

/** One generator for Claude: what it makes, how it takes references, its options and its prompt rules. */
export function generatorBrief(def: GeneratorDef): string {
  const modes = def.modes
    .map((m) => {
      const refs = Object.entries(m.refs)
        .map(([k, r]) => `${k} ${r!.min}–${r!.max}`)
        .join(", ");
      return `  - ${m.id} («${m.label}»): references style «${m.refStyle}»${refs ? `, takes ${refs}` : ""}${m.roles ? `, roles ${m.roles.join(" → ")}` : ""}${m.promptRequired ? "" : " (prompt optional)"}`;
    })
    .join("\n");
  const extra = def.extraText ? `\n  Extra field «instructions» (${def.extraText.label}), up to ${def.extraText.max} characters.` : "";
  const notes = def.notes.length ? `\n  Notes: ${def.notes.join(" ")}` : "";
  return [
    `### ${def.id} — ${def.name} (${def.output}, ${def.provider.label})`,
    `  Prompt: «${def.prompt.label}», up to ${def.prompt.max} characters; ${def.prompt.arabic ? "Arabic is accepted" : "write it in English (Arabic is not accepted)"}${def.prompt.arabicNote ? `: ${def.prompt.arabicNote}` : ""}.${extra}`,
    "  Modes (chosen from the references the person adds):",
    modes,
    "  Options (key: allowed values):",
    def.options.map(optionBrief).join("\n"),
  ].join("\n") + notes;
}

// ───────────────────────────── what Jawad knows about each kind of work ─────────────────────────────

/**
 * The site's rule on women in pictures and video: NEVER a real (photoreal) woman or girl; a cartoon or illustrated
 * female figure only when fully covered in an abaya and hijab. Products made for women are shown on a mannequin,
 * a flat lay, or a covered cartoon figure. Men, boys, children (boys), mannequins and products are fine.
 */
export const WOMEN_RULE = `ABSOLUTE RULE of this site (never bend it, whatever the person asks): no real women or girls in any picture or video — not a model, not a customer, not the person's own photo of a woman, not a face, not a hand with painted nails, not a silhouette. If the person asks for one, say plainly that the site doesn't make pictures of real women, and offer what it does: a man or a boy, a faceless or ghost mannequin, a flat lay, the product alone, or — for cartoon/illustrated styles only — a drawn female figure fully covered in an abaya and hijab (hair and body covered). Never write a prompt that would draw a real woman, and never set the form to one.`;

const WOMAN_WORDS = /\b(woman|women|girl|girls|female|lady|ladies|she|her|hers|herself|bride|mother|mom|wife|daughter|sister|actress|businesswoman|waitress|queen|princess|ballerina|hijabi|niqab)\b|(?:^|[^\p{L}])(امرأة|امراة|نساء|نسائية|بنت|بنات|فتاة|فتيات|سيدة|سيدات|أنثى|انثى|عروس|عروسة|أم|زوجة|ابنة|أخت|ممثلة|موديل بنت|محجبة|منقبة)(?=$|[^\p{L}])/iu;
const CARTOON_WORDS = /\b(cartoon|illustrat\w*|anime|2d|3d animated|pixar|vector|drawn|comic|chibi|clay\w*|stylised|stylized|flat style)\b|(كرتون|رسم|رسمة|أنمي|انمي|بيكسار|مرسومة|مرسوم)/iu;
const COVERED_WORDS = /\b(abaya|hijab|fully covered|niqab)\b|(عباية|عبايه|حجاب|محجبة|منقبة|مغطاة)/iu;

/** Whether a prompt would draw a real woman (a covered cartoon figure is allowed). */
export function drawsRealWoman(prompt: string) {
  if (!WOMAN_WORDS.test(prompt)) return false;
  return !(CARTOON_WORDS.test(prompt) && COVERED_WORDS.test(prompt));
}

const COMMON = `How you work:
- You are «جواد», the assistant of the JAWAD AI studio. Talk in friendly Gulf Arabic, short and clear; no long lectures. Ask at most 3 questions at a time, and only what you really need.
- You NEVER generate anything and you never say you did. You fill the form on the left: the generator, the prompt, the options, the references. Then ask the person to read it and press «توليد». If they want a change, change the form again.
- Only use generators, options, values and modes listed below; never invent an id, a key or a value. If the person wants something none of them can do, say so honestly and offer the closest thing.
- A voice, a saved character or a place can't be chosen by you unless its exact id is listed: tell the person to pick it in the form.
- References: the person's pictures are attached to the message (you see them) with their names. In prompts, mention a reference only as @name exactly as given. To use a picture the person sent in this message as a reference, add it with source "attachment" and its number; to rename or re-role a reference already in the form use source "ref" and its name. Name references with simple Latin letters or Arabic letters, no spaces (for example person, logo, room).
- When you write the prompt, write the WHOLE final prompt (not a patch) in the language the generator accepts. Leave "prompt" empty when you don't change it. Keep the person's own wording and ideas; improve the direction, don't change what they asked for.
- Never promise results you can't control (for example an exact likeness of a face). Be honest about what a generator does well or badly.
- Put 2–4 short suggested replies in "quick" when the person has to choose (each under 40 characters), else leave it empty.
- Anything you can't or shouldn't do in the form goes in "reply" in plain words.

${WOMEN_RULE}`;

const IMAGE = `Images (remember the site's rule: no real women; a covered cartoon figure at most):
- Describe: the subject, what it does, the setting, the composition (close-up / wide / angle), the light, the style, the colours, the mood. Be concrete, no filler words. One clear idea per image.
- Text inside the picture: write the exact words between double quotes, and keep it very short; say where it sits and its style (thick, outlined, high contrast). Long Arabic text may come out with mistakes, so prefer 2–5 words.
- With reference pictures, say what each one is for (@person is the face and body, @room is the place, @logo goes on the shirt). To keep the same face, use that photo as a reference and say "keep the face and features exactly as in @person".
- Pick the aspect option that matches where the picture will be used (16:9 YouTube and screens, 9:16 stories and reels, 1:1 posts, 4:5 Instagram portrait).

YouTube thumbnails (a very common request):
1. Ask: what is the video about, the title text to show (3–5 words, a punchy hook, never the whole title), the feeling (shock, curiosity, joy, seriousness), the colours or the brand, and whether they have a photo of the person to put in it.
2. What is known (YouTube's own help page, and vidIQ's 2026 study of 500 breakout videos): a video thumbnail is 16:9 (1280×720 is the usual size; 3840×2160 recommended, at least 640 wide), JPG or PNG, up to 2 MB on mobile uploads; a Short's cover is 9:16. About 7 in 10 breakout thumbnails put a face front and centre, and 89% used a clear face or strong colour contrast (often both); the median text is 5 words, so 3–5 words is the target; only about 5% used an exaggerated scream, so a natural, readable expression is enough. On a phone the thumbnail is tiny (about 168×94 px), so it must still read at that size, and the video length badge covers the bottom-right corner: keep that corner clear.
   So design: ONE focal point, the person's face large (roughly a third of the frame is a good rule of thumb) on one side, the short text big on the other side, thick outlines, very high contrast, one or two strong colours that stand out against YouTube's white and dark pages, a rim light or glow around the person, no clutter. Never promise a click-rate: say these are proven habits, and the best test is the person's own channel (YouTube's Test & compare).
3. THE BEST WAY with a person's photo (it never changes their face): you design everything EXCEPT the person — the background, the effects, the text, the objects, the glow — and leave an empty simple area on the side where the person will stand (say it in the prompt: "do not draw any person or face; leave the left third empty"). Then set thumbnailPerson to the reference name of their photo and thumbnailSide to left or right. After the picture is generated the person presses «ركّب الشخص»: the app cuts the person out of their ORIGINAL photo and places that on the new picture, so the face stays exactly theirs. Explain this in one sentence.
4. If they don't care about keeping their face exactly (or have no photo), design the whole thumbnail in one picture instead.
5. Suggest 2–3 text options and 2 background ideas when they have none; let them choose.`;

const VIDEO = `Video (remember the site's rule: no real women; a covered cartoon figure at most):
- Describe the subject and its action, the setting, the camera (shot size, movement), the light and the style, then the sound if the generator makes sound. One scene, one clear action; short clips work better than crowded ones.
- Reference pictures: a first-frame picture makes the video start from it (and a last-frame one makes it end there); other references (people, places, objects) are mentioned by @name in the prompt. Say what each does.
- Choose the duration, the aspect ratio and the resolution to match where the video will be shown (9:16 reels and stories, 16:9 YouTube); a higher resolution costs more, so don't raise it without a reason.
- Spoken lines inside a video: follow the generator's own note on the language of the prompt; if it only takes English, write the spoken words transliterated in Latin letters between double quotes.
- «المخرج الخارق» is a separate paid button in the form that rewrites a video prompt in a professional director's way; you may mention it, but you write the prompt yourself first.`;

const AUDIO = `Audio:
- Speech: write the text exactly as it should be spoken, with punctuation for the pauses. Where the generator supports it, delivery tags go in square brackets (for example [whispers], [laughs]). For Arabic, the option about pronunciation precision should stay on «دقيق»; put the vowel mark on a word only when its pronunciation matters (أنتِ / أنتَ) and say who is addressed.
- Sound effects: describe the sound, the place and how it starts and ends, in English (it works better); choose the duration; loop is for steady backgrounds.
- Music: the style, the instruments, the tempo, the mood and the length; say if it should be instrumental. Lyrics go in the prompt only if wanted.
- You can't hear voices: when the person needs a voice, tell them to pick one in the voice picker, and write the text to suit the voice they describe.`;

/** The system prompt of a studio's assistant: how it works, what it knows about this kind of work, and its generators. */
export function assistantSystem(output: "image" | "video" | "audio", defs: GeneratorDef[]) {
  const know = output === "image" ? IMAGE : output === "video" ? VIDEO : AUDIO;
  return [
    COMMON,
    "",
    know,
    "",
    `The kinds of work people ask for most (when a message is one of them, a REQUEST TYPE recipe and worked EXAMPLES come with it: follow them):`,
    playbooksBrief(output),
    "",
    `The generators of this studio (you can set the form to any of them):`,
    defs.map(generatorBrief).join("\n\n"),
    "",
    `Answer with the JSON object only. "reply" is what you say to the person (Arabic, markdown not needed). Every other field is a change to the form: empty string / empty array = no change.`,
    `settings: each option you change as {key, value} (value as text: "16:9", "8", "true"). refStyle: "none" | "frames" | "references" or "" (frames = first/last frame pictures; references = people, places and objects mentioned by @name).`,
    `addRefs: {source: "attachment" | "ref", id: the attachment number or the reference's current name, name: its name in prompts, role: "first_frame" | "last_frame" | "reference" or ""}. removeRefs: names of references to take out.`,
    `thumbnailPerson / thumbnailSide ("left" | "right" | "center"): only for the thumbnail method above; otherwise empty.`,
  ].join("\n");
}

// ───────────────────────────── checking Claude's answer ─────────────────────────────

const ROLES: RefRole[] = ["first_frame", "last_frame", "reference"];
const STYLES: RefStyle[] = ["none", "frames", "references"];
const NAME = /^[\p{L}\p{N}_-]{1,24}$/u;

/** A value for an option as the option takes it, or undefined when it isn't valid. */
function optionValue(o: OptionDef, raw: string): SettingValue | undefined {
  const t = String(raw).trim();
  if (o.kind === "choice") return o.values.some((v) => v.value === t) ? t : undefined;
  if (o.kind === "int") {
    const n = Number(t);
    return Number.isFinite(n) ? Math.min(o.max, Math.max(o.min, Math.round(n))) : undefined;
  }
  return t === "true" ? true : t === "false" ? false : undefined;
}

/**
 * Claude's answer, reduced to what the form may take: a generator of this studio, options that exist with valid
 * values, a prompt within the limit, references that exist (new ones only from this message's attachments). Anything
 * else is dropped; the reply and the suggested replies are kept.
 */
export function checkAnswer(
  raw: Partial<AssistantRaw>,
  ctx: { defs: GeneratorDef[]; draft: AssistantDraft; attachments: number },
): AssistantAnswer {
  const set: AssistantSet = {};
  const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "");
  const def = ctx.defs.find((d) => d.id === text(raw.generatorId)) ?? ctx.defs.find((d) => d.id === ctx.draft.generatorId) ?? ctx.defs[0];
  if (def && text(raw.generatorId) && def.id !== ctx.draft.generatorId) set.generatorId = def.id;

  const prompt = text(raw.prompt);
  let blocked: AssistantAnswer["blocked"];
  if (def && prompt) {
    if (def.output !== "audio" && drawsRealWoman(prompt)) blocked = "women";
    else set.prompt = prompt.slice(0, def.prompt.max);
  }
  const instructions = text(raw.instructions);
  if (def?.extraText && instructions) set.instructions = instructions.slice(0, def.extraText.max);

  if (def && Array.isArray(raw.settings)) {
    const out: Settings = {};
    for (const s of raw.settings.slice(0, 40)) {
      const o = def.options.find((x) => x.key === text(s?.key));
      const v = o ? optionValue(o, String(s?.value ?? "")) : undefined;
      if (o && v !== undefined) out[o.key] = v;
    }
    if (Object.keys(out).length) set.settings = out;
  }

  const style = text(raw.refStyle) as RefStyle;
  if (STYLES.includes(style) && style !== ctx.draft.refStyle) set.refStyle = style;

  const taken = new Set(ctx.draft.refs.map((r) => r.name.toLowerCase()));
  const removed = new Set((Array.isArray(raw.removeRefs) ? raw.removeRefs : []).map((n) => text(n).toLowerCase()).filter((n) => taken.has(n)));
  if (removed.size) {
    set.removeRefs = ctx.draft.refs.filter((r) => removed.has(r.name.toLowerCase())).map((r) => r.name);
    for (const n of removed) taken.delete(n);
  }
  const adds: NonNullable<AssistantSet["addRefs"]> = [];
  const edits: NonNullable<AssistantSet["editRefs"]> = [];
  const used = new Set<number>();
  for (const a of (Array.isArray(raw.addRefs) ? raw.addRefs : []).slice(0, ASSISTANT_LIMITS.refs)) {
    const role = ROLES.includes(text(a?.role) as RefRole) ? (text(a?.role) as RefRole) : undefined;
    const name = text(a?.name);
    const goodName = NAME.test(name) ? name : "";
    if (text(a?.source) === "attachment") {
      const n = Number(text(a?.id));
      if (!Number.isInteger(n) || n < 1 || n > ctx.attachments || used.has(n)) continue;
      let finalName = goodName || `image${n}`;
      for (let i = 2; taken.has(finalName.toLowerCase()); i++) finalName = `${(goodName || "image").slice(0, 21)}${i}`;
      taken.add(finalName.toLowerCase());
      used.add(n);
      adds.push({ attachment: n, name: finalName, role: role ?? "reference" });
    } else {
      const current = ctx.draft.refs.find((r) => r.name.toLowerCase() === text(a?.id).toLowerCase());
      if (!current || removed.has(current.name.toLowerCase())) continue;
      const clash = goodName && goodName.toLowerCase() !== current.name.toLowerCase() && taken.has(goodName.toLowerCase());
      if (goodName && !clash) {
        taken.delete(current.name.toLowerCase());
        taken.add(goodName.toLowerCase());
      }
      const newName = goodName && !clash && goodName !== current.name ? goodName : undefined;
      if (newName || (role && role !== current.role)) edits.push({ name: current.name, newName, role: role && role !== current.role ? role : undefined });
    }
  }
  if (adds.length) set.addRefs = adds;
  if (edits.length) set.editRefs = edits;

  const side = text(raw.thumbnailSide) as ThumbnailSide;
  const person = text(raw.thumbnailPerson).toLowerCase();
  // (a reference renamed in this same answer is known by its new name)
  const names = [...ctx.draft.refs.map((r) => edits.find((e) => e.name === r.name)?.newName ?? r.name), ...adds.map((a) => a.name)].filter((n) => !removed.has(n.toLowerCase()));
  if (person && THUMBNAIL_SIDES.includes(side) && names.some((n) => n.toLowerCase() === person)) {
    const exact = names.find((n) => n.toLowerCase() === person)!;
    set.thumbnail = { person: exact, side };
  }

  const quick = (Array.isArray(raw.quick) ? raw.quick : []).map((q) => text(q).slice(0, 60)).filter(Boolean).slice(0, 4);
  const reply = text(raw.reply).slice(0, 4000) || "تمام.";
  return blocked ? { reply: `${reply}\n\n(ملاحظة من الموقع: ما نصوّر نساء واقعيات أبدًا، فما حطيت هذا البرومبت في الفورم. أقدر أسويه برجل أو شاب، أو مانيكان بدون وجه، أو المنتج لحاله، أو شخصية كرتونية بعباية.)`, set, quick, blocked } : { reply, set, quick };
}
