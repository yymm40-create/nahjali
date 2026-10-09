// «الجواد الذكي!» | JAWAD AI — «التعديل الذكي»: the one who writes the final prompt is جواد himself, the studio's
// assistant (the same brain as the chat: his system prompt, his knowledge of the generators and of the kinds of work,
// his women rule, his answer checks). The request reaches him as it is — the person's own words, untouched — with the
// whole shot, and the edit is one more REQUEST TYPE of his (like «video-transform»): the recipe comes with the message.
// He decides the prompt and the locks he carries over in ONE answer; the website's mechanical rules (length, language,
// real @names, the continuity checker, his own locks) only send a fault back to him — nothing writes before or after him.
// Server only.

import { callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn, type ClaudeUsage } from "@/lib/film/anthropic";
import { SUPER_DIRECTOR } from "@config/film-prompts/director";
import { ASSISTANT_SCHEMA, assistantSystem, checkAnswer, WOMEN_RULE, type AssistantDraft, type AssistantRaw } from "@config/jawad/assistant";
import { JAWAD_EDIT_IDENTITY } from "@config/jawad/smart-edit-training";
import type { GeneratorDef } from "@config/jawad/types";
import { directorProblems, directorPrompt, salvageDirector } from "../director";
import { KEPT_RULES, LOCKS_SCHEMA, readLocks, type EditLock } from "../edit-locks";
import { EDIT_TASK } from "./director";
import { ProviderError } from "./providers/common";

/** جواد's answer in a smart edit: his usual fields (only the prompt and the reply are used), the Chinese twin of a video prompt, and the locks. */
export type EditRaw = AssistantRaw & { promptZh: string; kept: unknown };

export const EDIT_SCHEMA = {
  ...ASSISTANT_SCHEMA,
  properties: { ...ASSISTANT_SCHEMA.properties, promptZh: { type: "string" }, kept: LOCKS_SCHEMA.properties.locks },
  required: [...ASSISTANT_SCHEMA.required, "promptZh", "kept"],
};

/** What the answer's fields are in this request type (said once, after the recipe). */
const ANSWER_FIELDS = `HOW TO ANSWER THIS REQUEST TYPE: the JSON object as usual, but fill only these: "prompt" = the final prompt (the whole prompt, in English; spoken lines inside double quotes as the generator's note says); "promptZh" = the same prompt in Chinese for a video (empty for a picture); "kept" = the locks (below); "reply" = one short line in Arabic. Leave every other field empty ("generatorId", "instructions", "settings", "refStyle", "addRefs", "removeRefs", "thumbnailPerson", "thumbnailSide", "quick").`;

/**
 * جواد's whole system prompt for a smart edit: his own (what he is and knows), then this request type's recipe — who
 * decides, and, for a video, the director's craft he writes video prompts with (the skill behind «المخرج الخارق»).
 */
export function editSystem(def: GeneratorDef, rules: string): string {
  return [
    assistantSystem(def.output as "image" | "video" | "audio", [def]),
    JAWAD_EDIT_IDENTITY,
    def.output === "video" ? `THE DIRECTOR'S CRAFT you write a video prompt with (the approved skill, yours to use; its website rules and this task come after it):\n\n${SUPER_DIRECTOR}${EDIT_TASK}` : rules,
    ANSWER_FIELDS,
  ].join("\n\n---\n\n");
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Asks جواد for the final prompt (up to three tries for a video, two for a picture: the mechanical faults go back to him).
 * `parts` already hold the whole shot and the person's words; `extra` is the continuity checker; `problems` the picture's rules.
 */
export async function jawadWritesEdit(o: {
  def: GeneratorDef;
  parts: ClaudePart[];
  names: string[];
  /** a picture's own rules (SAME / FULL, @result) */
  rules: string;
  draft: AssistantDraft;
  previous: string;
  /** «same» edits the picture itself: no locks to declare */
  noLocks?: boolean;
  /** video: the continuity checker and his own locks, once the website's rules hold; picture: the same, but not on the last try */
  extra?: (prompt: string, kept: EditLock[]) => string[];
  /** picture: the rules a picture prompt must keep */
  problems?: (prompt: string) => string[];
}): Promise<{ prompt: string; usd: number; attempts: number; kept: EditLock[]; reply: string }> {
  const video = o.def.output === "video";
  const tries = video ? 3 : 2;
  const system = editSystem(o.def, o.rules);
  let turns: ClaudeTurn[] = [{ role: "user", content: [...o.parts, { type: "text", text: o.noLocks ? 'Leave "kept" empty: the picture itself stays as it is.' : KEPT_RULES }] }];
  const usage: ClaudeUsage[] = [];
  const cost = () => usage.reduce((t, u) => t + claudeCost(u), 0);
  let last: { en: string; zh: string } | null = null;
  let lastKept: EditLock[] = [];
  let left: string[] = [];
  let women = false;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const r = await callClaudeJson<EditRaw>({ system, turns, schema: EDIT_SCHEMA, maxTokens: 16000 });
    usage.push(r.usage);
    const en = text(r.data.prompt);
    const zh = text(r.data.promptZh);
    last = { en, zh: zh || en };
    lastKept = o.noLocks ? [] : readLocks({ locks: r.data.kept }, o.previous);
    // his own answer checks (the site's rule on women, the prompt's limit), as in the chat
    const checked = checkAnswer(r.data, { defs: [o.def], draft: o.draft, attachments: 0 });
    women = checked.blocked === "women";
    if (women) left = [`${WOMEN_RULE} Write the prompt again without a real woman or girl.`];
    else if (!en) left = ['The "prompt" is empty: write the whole final prompt.'];
    else if (video) left = directorProblems({ en, zh: zh || "-" }, o.names);
    else left = o.problems?.(en) ?? [];
    const final = video ? directorPrompt({ en, zh: zh || en }) : en;
    // the locks he declared and the continuity checker read the prompt once the rules hold (a picture's last try is used as it is)
    if (!left.length && o.extra && (video || attempt < tries)) left = o.extra(final, lastKept);
    if (!left.length) return { prompt: final, usd: cost(), attempts: attempt, kept: lastKept, reply: checked.reply };
    turns = [...turns, { role: "assistant", content: r.raw }, { role: "user", content: `Fix these and return the complete JSON again:\n- ${left.join("\n- ")}` }];
  }
  // the site's rule on women is never repaired around: the edit stops here (the coins go back)
  if (women) throw new ProviderError("rejected", "الموقع ما يصنع نساء واقعيات أبدًا، وهذا التعديل يطلب واحدة. غيّر وصف التعديل (رجل أو شاب أو مانيكان بدون وجه أو المنتج لحاله أو شخصية كرتونية بعباية). أُعيدت لك نقودك.", "women rule");
  // a video still off after three tries: repaired where it is safe and used (an edit that works beats a refusal)
  const saved = video && last ? salvageDirector({ en: last.en, zh: last.zh }, o.names) : null;
  if (saved) {
    console.warn("jawad edit used after repair", { problems: left });
    return { prompt: directorPrompt(saved), usd: cost(), attempts: tries, kept: lastKept, reply: "" };
  }
  throw new Error(`jawad's edit prompt broke the rules ${tries} times: ${left.join(" | ").slice(0, 400)}`);
}
