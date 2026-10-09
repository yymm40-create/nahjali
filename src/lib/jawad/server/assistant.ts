// «الجواد الذكي!» | JAWAD AI — «جواد», the studio's chat assistant. Server only.
//
//   One request = one turn: the conversation so far, what the form holds now, and the pictures the person attached.
//   Claude answers with a reply and changes to the form (config/jawad/assistant.ts checks them). Nothing is generated
//   here, and the person's pictures are shown to Claude by short-lived links to their own stored files only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLeader, callClaudeJson, claudeCost, type ClaudePart, type ClaudeTurn } from "@/lib/film/anthropic";
import { generatorById } from "@config/jawad/generators";
import { ASSISTANT_LIMITS, ASSISTANT_SCHEMA, assistantSystem, checkAnswer, type AssistantAnswer, type AssistantDraft, type AssistantRaw, type AssistantRef } from "@config/jawad/assistant";
import type { GeneratorDef, RefRole, RefStyle, Settings } from "@config/jawad/types";
import { detectPlaybook, playbookGuide } from "@config/jawad/playbooks";
import { examplesBrief, nearestExamples } from "@config/jawad/playbook-examples";
import { FIGHT_METHOD, FIGHT_PLAYBOOK_ID, SCHOOLS_BRIEF, fightCasesBrief, nearestFightCases } from "@config/jawad/fight-scenes";
import { TRANSFORM_METHOD, TRANSFORM_PLAYBOOK_ID, nearestTransformCases, transformCasesBrief } from "@config/jawad/video-transform";
import { loadRuntime, sectionGenerators } from "./runtime";
import { isUuid, uploadViews, type UploadRow } from "./uploads";

const db = () => createAdminClient();

export interface AssistantBody {
  sectionId?: unknown;
  messages?: unknown;
  draft?: unknown;
  attachments?: unknown;
  /** the Claude model the person chose (config/claude-models.ts) */
  model?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** The person's ready uploads among these ids (never anyone else's). */
async function ownUploads(userId: string, ids: string[]) {
  if (!ids.length) return new Map<string, UploadRow>();
  const { data } = await db().from("jawad_uploads").select("*").in("id", ids).eq("user_id", userId).eq("status", "ready");
  return new Map(((data ?? []) as UploadRow[]).map((r) => [r.id, r]));
}

/** What Claude is told about a stored reference. */
const refLine = (r: AssistantRef) =>
  `@${r.name} — ${r.kind}${r.kind !== "audio" && r.width && r.height ? ` ${r.width}×${r.height}` : ""}${r.durationMs ? ` ${(r.durationMs / 1000).toFixed(1)}s` : ""}, role ${r.role}`;

/** One turn of the assistant. */
export async function assistantTurn(user: { id: string; email?: string | null }, owner: boolean, b: AssistantBody): Promise<AssistantAnswer & { attachments: { uploadId: string }[]; usd: number }> {
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("المساعد جواد غير متاح حاليًا.", 503);
  const rt = await loadRuntime();
  if (!rt.migrated) throw new UserError("منصة JAWAD AI قيد التجهيز (قاعدة البيانات).", 503);
  const section = rt.sections.find((s) => s.id === b.sectionId);
  if (!section?.output) throw new UserError("قسم غير صحيح.", 400);
  const defs = sectionGenerators(rt, section.id, owner)
    .map((g) => generatorById(g.id))
    .filter((d): d is GeneratorDef => Boolean(d));
  if (!defs.length) throw new UserError("لا يوجد مولد متاح في هذا القسم.", 403);

  // The conversation: the last turns, starting with the person's (the API wants user first, alternating)
  const raw = (Array.isArray(b.messages) ? b.messages : []).slice(-ASSISTANT_LIMITS.history).map((m) => {
    const x = (m ?? {}) as { role?: unknown; text?: unknown };
    return { role: x.role === "assistant" ? ("assistant" as const) : ("user" as const), text: str(x.text, ASSISTANT_LIMITS.message).trim() };
  });
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  for (const m of raw) {
    if (!m.text) continue;
    if (turns.length && turns[turns.length - 1].role === m.role) turns[turns.length - 1].text += `\n${m.text}`;
    else turns.push(m);
  }
  while (turns.length && turns[0].role !== "user") turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== "user") throw new UserError("اكتب رسالتك.", 400);

  // The form now
  const d = (b.draft ?? {}) as Record<string, unknown>;
  const rawRefs = (Array.isArray(d.refs) ? d.refs : []).slice(0, ASSISTANT_LIMITS.refs).map((r) => (r ?? {}) as Record<string, unknown>);
  const ids = rawRefs.map((r) => String(r.uploadId ?? "")).filter(isUuid);
  const attachIds = (Array.isArray(b.attachments) ? b.attachments : []).map((a) => String((a as { uploadId?: unknown })?.uploadId ?? "")).filter(isUuid).slice(0, ASSISTANT_LIMITS.attachments);
  const uploads = await ownUploads(user.id, [...new Set([...ids, ...attachIds])]);
  const refs: AssistantRef[] = rawRefs.flatMap((r) => {
    const u = uploads.get(String(r.uploadId ?? ""));
    if (!u) return [];
    const role = (["first_frame", "last_frame", "reference"] as RefRole[]).includes(r.role as RefRole) ? (r.role as RefRole) : "reference";
    return [{ uploadId: u.id, name: str(r.name, 24), kind: u.kind, role, width: u.width, height: u.height, durationMs: u.duration_ms }];
  });
  const attached = attachIds.flatMap((id) => (uploads.has(id) ? [uploads.get(id)!] : []));
  const draftDef = defs.find((x) => x.id === d.generatorId) ?? defs[0];
  const refStyle: RefStyle = d.refStyle === "frames" || d.refStyle === "references" ? d.refStyle : "none";
  const draft: AssistantDraft = {
    generatorId: draftDef.id,
    prompt: str(d.prompt, draftDef.prompt.max),
    instructions: str(d.instructions, 2000),
    settings: (d.settings && typeof d.settings === "object" ? d.settings : {}) as Settings,
    refStyle,
    refs,
  };

  // Pictures Claude looks at: the ones attached now first, then the form's own (links, short-lived)
  const views = new Map((await uploadViews([...attached, ...refs.map((r) => uploads.get(r.uploadId)!).filter((u) => !attached.some((a) => a.id === u.id))])).map((v) => [v.id, v]));
  const parts: ClaudePart[] = [];
  const seen = new Set<string>();
  const look = (u: UploadRow, label: string) => {
    const v = views.get(u.id);
    if (u.kind !== "image" || !v?.url || seen.has(u.id) || seen.size >= ASSISTANT_LIMITS.images) return;
    seen.add(u.id);
    parts.push({ type: "text", text: label }, { type: "image", url: v.url });
  };
  attached.forEach((u, i) => look(u, `Attachment ${i + 1} (sent with this message):`));
  for (const r of refs) look(uploads.get(r.uploadId)!, `Reference @${r.name} (already in the form):`);

  const state = [
    `FORM NOW (generator ${draft.generatorId}):`,
    `prompt: ${draft.prompt ? `<<<\n${draft.prompt}\n>>>` : "(empty)"}`,
    draft.instructions ? `instructions: ${draft.instructions}` : "",
    `settings: ${JSON.stringify(draft.settings)}`,
    `references style: ${draft.refStyle}`,
    `references: ${refs.length ? refs.map(refLine).join("; ") : "none"}`,
    attached.length ? `ATTACHMENTS of this message: ${attached.map((u, i) => `${i + 1}. ${u.kind} ${u.file_name}${u.width && u.height ? ` ${u.width}×${u.height}` : ""}`).join("; ")}` : "No attachments in this message.",
  ]
    .filter(Boolean)
    .join("\n");

  // The kind of work this is (from this message, then the conversation): its recipe and the closest worked examples
  const lastText = turns[turns.length - 1].text;
  const earlier = turns.slice(0, -1).map((t) => t.text).join("\n");
  const kind = detectPlaybook(lastText, earlier);
  const guide = kind ? playbookGuide(kind, section.output) : "";
  // a real person's own clip transformed: the method and the worked before→after cases instead of the plain examples
  const transform = kind === TRANSFORM_PLAYBOOK_ID;
  const fight = kind === FIGHT_PLAYBOOK_ID;
  const examples = transform
    ? `${TRANSFORM_METHOD}\n\n${transformCasesBrief(nearestTransformCases(lastText, 3))}`
    : fight
      ? `${FIGHT_METHOD}\n\nTHE SCHOOLS:\n${SCHOOLS_BRIEF}\n\n${fightCasesBrief(nearestFightCases(lastText, 3))}`
      : examplesBrief(nearestExamples(lastText, section.output, 3, earlier));
  const claudeTurns: ClaudeTurn[] = turns.map((t, i) => {
    if (i < turns.length - 1) return { role: t.role, content: t.text };
    // The last message carries the form, the pictures, the recipe and the examples
    return { role: "user", content: [...parts, { type: "text", text: [state, guide, examples, `THE PERSON'S MESSAGE:\n${t.text}`].filter(Boolean).join("\n\n") } as ClaudePart] };
  });

  const out = await callClaudeJson<AssistantRaw>({
    system: assistantSystem(section.output, defs),
    turns: claudeTurns,
    schema: ASSISTANT_SCHEMA,
    maxTokens: 6000,
    effort: "medium",
    fallback: true,
    leader: isLeader(user.email),
  }).catch((e) => {
    console.error("assistant", String(e instanceof Error ? e.message : e).slice(0, 300));
    throw new UserError("تعذّر على جواد الرد الآن؛ جرّب مرة ثانية.", 502);
  });

  const answer = checkAnswer(out.data, { defs, draft, attachments: attached.length });
  return { ...answer, attachments: attached.map((u) => ({ uploadId: u.id })), usd: claudeCost(out.usage) };
}
