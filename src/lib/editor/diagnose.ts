// «🩺 تشخيص» — the owner asks «حيدرة» what went wrong («ليش صار كذا؟») and it looks inside: what the browser
// recorded (errors, failed requests, media that didn't load, the device), the project as the server keeps it (its
// files and their state, the last saves, the generation jobs), which services are set up, and the preview as it looks.
// It answers in Arabic (what happened, the likely cause, what to try now) and writes a message in English for the
// developer (Claude Code), with the evidence and where in the code to look, to be copied and sent on. Server only;
// the owner only (the report can hold technical details of the site).

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, claudeTrouble, type ClaudePart } from "@/lib/film/anthropic";
import { checkCommands, context } from "./assistant-core";
import { COMMANDS_GUIDE } from "./assistant-commands";
import { appendChat } from "./chat";
import { readTimeline, allTracks, flatten, duration, clipEnd, type Timeline } from "./model";
import { assetInfo, assetViews, stillOpen, type EditorProject } from "./server";
import type { Who } from "./pricing";

const db = () => createAdminClient();

/** Where things live in the code (for the developer's message). */
export const CODE_MAP = `src/components/jawad/editor/Editor.tsx — the editor page: state, top bar, panels, layout («واجهتي»), keyboard, save loop, menus, quick tools
src/components/jawad/editor/Timeline.tsx — the timeline UI (drag, trim, select, lanes, context menu)
src/components/jawad/editor/player.ts — live preview playback (media elements, Web Audio, sync)
src/components/jawad/editor/render.ts — draws one frame (preview and export share it): media, crop, transforms, texts, transitions, grading
src/components/jawad/editor/grade-gl.ts — WebGL2 grading shader (log decode, gamut, tone map, wheels, curves, secondaries, LUT, masks, film)
src/components/jawad/editor/GradePanel.tsx — the colour panel (layers, sections, compare, big wheels/curves)
src/components/jawad/editor/export.ts — in-browser export (WebCodecs via Mediabunny)
src/components/jawad/editor/media.ts, parts.ts, useUploads.ts — reading files, uploads (multipart for large files)
src/components/jawad/editor/audio.ts, voice.ts, stretch.ts, peaks.ts — sound decoding, voice work, time-stretch, waveforms
src/components/jawad/editor/AssistantPanel.tsx — «حيدرة» chat UI, what it sends, making requested assets
src/components/jawad/editor/Inspector.tsx, FxPanel.tsx, TransitionPanel.tsx, CaptionsPanel.tsx — the settings panels
src/components/jawad/editor/SmartFix.tsx — «التعديل الذكي» (red/green tracks, jobs)
src/components/jawad/editor/package.ts — project .zip save/open
src/lib/editor/model.ts — the timeline document, readers, sequences, flatten (Nest)
src/lib/editor/commands.ts — every timeline change (pure apply)
src/lib/editor/grade.ts — the grade model, logs, looks, LUTs
src/lib/editor/server.ts — projects, assets, saves (Supabase + R2 storage)
src/lib/editor/assistant.ts, assistant-core.ts, assistant-guide.ts — «حيدرة»'s prompt, context and checks
src/lib/editor/generate.ts — hook picture, music, sfx, sound separation (OpenAI, ElevenLabs, fal)
src/lib/editor/speech.ts — captions (ElevenLabs Scribe), poem alignment
src/lib/jawad/server/jobs.ts — JAWAD AI generation jobs
src/app/api/jawad/editor/projects/[id]/route.ts — the editor's API (actions)`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "commands", "developerMessage"],
  properties: {
    reply: { type: "string", description: "To the owner, in Gulf Arabic: what is happening, the most likely cause (say how sure you are), what you fixed yourself right now (when \"commands\" has any), and what to try now, step by step. Short." },
    commands: { type: "array", items: { type: "string", description: "One editing command as a JSON object string." }, description: "The editing commands that fix the problem on the timeline right now (empty when the cause is not in the timeline)." },
    developerMessage: { type: "string", description: "A message in English for the developer (Claude Code) to fix it: the symptom, the evidence (exact log lines, statuses, numbers), the suspected cause, where in the code to look (paths from the code map), how to reproduce, and a proposed fix. Empty when nothing needs the developer." },
  },
};

const SYSTEM = `You are «حيدرة», the assistant inside the «حيدرة كت» video editor, now in DIAGNOSIS mode for the site's owner (who also builds the site with a developer, Claude Code). The owner describes something that went wrong or looks wrong; you get a technical report of what really happened and must find the cause like a senior engineer.

You receive: the owner's words; the browser report (device and browser abilities, the editor's state, its media elements, and a log of errors, rejected promises, console errors/warnings, failed server requests with status and body, media that failed to load, and the editor's own notes, each with ms since the editor opened); the server's view (the project, its files and their status, the last saves, the latest generation jobs with their errors, which services are configured, the deployment — compare it with the browser report's «pageBuild»: when they differ, the open page runs older code than the server, and anything fixed since does not reach it until the page is reloaded; say so first); the timeline as JSON (the context format «حيدرة» uses) with a few computed checks; and, when available, a picture of the preview right now.

Work from evidence: quote the log lines and numbers that point to the cause; separate what you know from what you guess. Typical causes: a file still uploading or failed (status), an expired link (403 from storage), a browser without WebCodecs/WebGL2 (export or grading), a codec the browser can't decode (HEVC/ProRes on Chrome/Windows), memory, a 401 (signed out), a 409 (saved from another tab), a provider error (jobs), a timeline that points to a missing file, a wrong log/gamut setting making footage look glowing or flat, a muted/hidden track, a clip out of its source range. When the report has no trace of the problem, say exactly how to catch it: do the thing again, then press «تشخيص» right away.

FIX IT YOURSELF: when the cause lives in the timeline — a muted or hidden track, a clip that plays past its file, overlapping clips, a wrong log/gamut/range on a grade (glowing or flat footage), a text off the safe area or too small, a missing transition, a clip pointing to a file that is gone (delete it), a volume at 0, a sound track without ducking under speech — put the commands that fix it in "commands" (the same editing commands «حيدرة» uses, listed below; use only ids that appear in the timeline) and tell the owner in "reply" what you fixed. When the cause is a file, a service, the browser or the code, send no commands and say what to do instead. Never pretend a change was made.

${COMMANDS_GUIDE}

The reply is for the owner (Gulf Arabic, short, practical). The developer message is English, precise and complete enough for the developer to fix it without asking: include file paths from the code map. Never invent log lines.

CODE MAP:
${CODE_MAP}`;

/** Quick checks on the timeline that often explain «ما يطلع / ما يشتغل». */
export function timelineChecks(tl: Timeline, assets: { id: string; status: string; durationMs: number | null; kind: string }[]) {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const out: string[] = [];
  for (const t of allTracks(tl)) {
    for (const c of t.clips) {
      const a = c.assetId ? byId.get(c.assetId) : null;
      if (c.assetId && !a) out.push(`clip ${c.id} on track "${t.name}" points to a file that is not in the library (${c.assetId})`);
      else if (a && a.status !== "ready") out.push(`clip ${c.id} uses file ${a.id} whose status is "${a.status}"`);
      if (a?.durationMs && a.kind !== "image" && c.out > a.durationMs + 50) out.push(`clip ${c.id} plays to ${c.out} ms but its file is ${a.durationMs} ms long`);
      if (c.grades.some((g) => g.on && g.log !== "none")) out.push(`clip ${c.id} decodes a log: ${c.grades.filter((g) => g.on && g.log !== "none").map((g) => `${g.log}/${g.logGamut}/${g.logRange}`).join(", ")}`);
    }
    if (t.muted) out.push(`track "${t.name}" (${t.kind}) is muted`);
    if (t.hidden) out.push(`track "${t.name}" (${t.kind}) is hidden`);
    const sorted = [...t.clips].sort((x, y) => x.start - y.start);
    for (let i = 1; i < sorted.length; i++) if (sorted[i].start < clipEnd(sorted[i - 1]) - 1) out.push(`clips ${sorted[i - 1].id} and ${sorted[i].id} overlap on track "${t.name}"`);
  }
  if (!duration(flatten(tl))) out.push("the timeline is empty");
  return out.slice(0, 60);
}

const cut = (v: unknown, n: number) => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? null);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

export async function diagnose(p: EditorProject, who: Who, b: { message?: unknown; report?: unknown; timeline?: unknown; shot?: unknown; selected?: unknown; playhead?: unknown }) {
  if (!who.owner) throw new UserError("التشخيص لصاحب الموقع فقط.", 403);
  stillOpen(p);
  const message = String(b.message ?? "").trim().slice(0, 2000) || "شنو المشكلة هنا؟";
  if (!process.env.ANTHROPIC_API_KEY) throw new UserError("حيدرة غير مفعّل على الخادم.", 503);

  const assets = await assetViews(p.id);
  const { data: rows } = await db().from("editor_assets").select("id,kind,name,status,mime,bytes,duration_ms,width,height,origin,meta,created_at").eq("project_id", p.id);
  const files = (rows ?? []).map((r) => {
    const meta = (r.meta ?? {}) as Record<string, unknown>;
    // the transcripts are long and say nothing about faults: their presence only
    const { transcripts, ...rest } = meta;
    return { ...r, meta: { ...rest, ...(transcripts ? { transcripts: Object.keys(transcripts as object).length } : {}) } };
  });
  const { data: ops } = await db().from("editor_ops").select("actor,label,version,created_at").eq("project_id", p.id).order("created_at", { ascending: false }).limit(15);
  const { data: jobs } = await db().from("jawad_jobs").select("id,generator_id,status,submit_state,provider_status,error_message,error_detail,created_at,updated_at,finished_at").eq("user_id", p.user_id).order("created_at", { ascending: false }).limit(8);
  const env = {
    ...Object.fromEntries(["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "ELEVENLABS_API_KEY", "FAL_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "NEXT_PUBLIC_SUPABASE_URL"].map((k) => [k, !!process.env[k]])),
    // the video generator's key goes by several names
    SEEDANCE: ["ARK_API_KEY", "seedance_api", "SEEDANCE_API"].some((k) => !!process.env[k]),
  };
  const server = {
    project: { id: p.id, kind: p.kind, version: p.version, created: p.created_at, updated: p.updated_at, exported: p.exported_at, purgeAt: p.purge_at, purged: p.purged_at },
    files,
    lastSaves: ops ?? [],
    jobs: (jobs ?? []).map((j) => ({ ...j, error_detail: j.error_detail ? cut(j.error_detail, 400) : null })),
    services: env,
    deployment: { commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ?? null, env: process.env.VERCEL_ENV ?? null, region: process.env.VERCEL_REGION ?? null },
    now: new Date().toISOString(),
  };

  const tl = readTimeline(b.timeline ?? p.timeline, new Set(assets.map((a) => a.id)));
  const ctx = context(tl, assets, new Map(), { playhead: b.playhead, selected: b.selected });
  const checks = timelineChecks(tl, assets.map((a) => ({ id: a.id, status: a.status, durationMs: a.durationMs, kind: a.kind })));
  const shot = typeof b.shot === "string" && b.shot.length < 600_000 && /^[A-Za-z0-9+/]+=*$/.test(b.shot) ? b.shot : null;

  const text = [
    `OWNER'S WORDS:\n${message}`,
    `BROWSER REPORT:\n${cut(b.report, 60_000)}`,
    `SERVER:\n${cut(server, 30_000)}`,
    `TIMELINE CHECKS:\n${checks.length ? checks.map((c) => `- ${c}`).join("\n") : "(nothing unusual)"}`,
    `TIMELINE:\n${cut(ctx, 40_000)}`,
    shot ? "THE PREVIEW RIGHT NOW is attached as a picture." : "(no preview picture)",
  ].join("\n\n");
  const content: string | ClaudePart[] = shot ? [{ type: "text", text }, { type: "image64", data: shot, mediaType: "image/jpeg" }] : text;

  const r = await callClaudeJson<{ reply: string; commands: string[]; developerMessage: string }>({ system: SYSTEM, turns: [{ role: "user", content }], schema: SCHEMA, maxTokens: 16000, effort: "high", fallback: true }).catch((e) => {
    console.error("editor diagnose", e);
    throw new UserError(claudeTrouble(e) ?? "ما قدر حيدرة يشخّص الحين؛ جرّب بعد شوي.", 502);
  });
  const dev = r.data.developerMessage.trim();
  // the fixes he proposes are tried on the timeline first; a broken one is dropped and said so
  const infos = new Map(assets.map((a) => [a.id, assetInfo(a)]));
  const checked = checkCommands(tl, r.data.commands ?? [], infos);
  const commands = checked.error ? checked.cmds.slice(0, checked.error.i) : checked.cmds;
  const dropped = checked.error ? `\n\n(ما قدرت أطبّق أحد الإصلاحات: ${checked.error.message})` : "";
  const reply = `🩺 ${r.data.reply.trim()}${commands.length ? `\n\n🛠️ طبّقت ${commands.length} إصلاح على التايملاين.` : ""}${dropped}${dev ? `\n\n**رسالة للمطوّر** (انسخها وأرسلها):\n\`\`\`\n${dev}\n\`\`\`` : ""}`;
  await db().from("editor_ops").insert({ project_id: p.id, version: p.version, actor: "claude", label: claudeCost(r.usage).toFixed(4) });
  await appendChat(p, [{ role: "user", text: `🩺 ${message}` }, { role: "assistant", text: reply }]);
  return { reply, commands };
}
