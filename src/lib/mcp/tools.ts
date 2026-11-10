// «الجواد في كلاود وشات جي بي تي» · the connector's tools. Server only.
//
// Each tool calls the same route handler the person's page calls (callRoute, inside actAs), so a connector can do only
// what the person may do on the site, at the site's prices, from the person's own wallet. Where a section finishes its
// work in the browser (the designs «حيدرا ماكس» draws in code, the motion and the export of «حيدرة كت», the steps of
// «الطالب الذكي»), the tool says so and gives the link that opens that very conversation or project on the site, where
// the page goes on by itself.

import { createHash } from "node:crypto";
import { coinStr } from "@config/coins";
import { FILM_STYLES } from "@config/film-styles";
import { generatorById } from "@config/jawad/generators";
import { LEVELS } from "@config/jawad/student";
import { PROJECT_KINDS } from "@/lib/editor/model";
import { coinBalance } from "@/lib/coins";
import { loadRuntime } from "@/lib/jawad/server/runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { outputFile } from "@/lib/jawad/student/actions";
import { freeFor } from "@/lib/jawad/server/access";
import { isAdmin } from "@config/site";
import type { User } from "@supabase/supabase-js";
import { callRoute } from "./call-route";
import * as studioGenerate from "@/app/api/jawad/generate/route";
import * as studioJobs from "@/app/api/jawad/jobs/route";
import * as studioVoices from "@/app/api/jawad/voices/route";
import * as contentChat from "@/app/api/content/chat/route";
import * as contentChats from "@/app/api/content/chats/route";
import * as contentProduce from "@/app/api/content/produce/route";
import * as contentMedia from "@/app/api/content/generate/route";
import * as designerChat from "@/app/api/designer/chat/route";
import * as designerChats from "@/app/api/designer/chats/route";
import * as studentProjects from "@/app/api/jawad/student/projects/route";
import * as studentProject from "@/app/api/jawad/student/projects/[id]/route";
import * as editorProjects from "@/app/api/jawad/editor/projects/route";

export interface ToolCtx {
  user: User;
  origin: string;
  signal?: AbortSignal;
}
type Json = Record<string, unknown>;
export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
  run: (args: Json, c: ToolCtx) => Promise<Json>;
}

const UUID = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const uuid = (v: unknown) => (typeof v === "string" && UUID.test(v) ? v : null);
const sar = (halalas: number | null | undefined) => (halalas == null ? null : coinStr(halalas));
const obj = (properties: Json, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

// ─────────────────────────────── the wallet ───────────────────────────────

const balance: ToolDef = {
  name: "jawad_balance",
  title: "رصيدي في الجواد",
  description: "Shows the person's JAWAD AI wallet balance (in Saudi riyals) and the link to top it up.",
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  run: async (_a, c) => {
    const b = await coinBalance(c.user.id);
    return { balance: sar(b), balance_halalas: b, unlimited: await freeFor(c.user), top_up: `${c.origin}/jawad-ai/coins` };
  },
};

// ─────────────────────────── «الاستوديو الإبداعي» ───────────────────────────

const OUTPUTS = ["image", "video", "audio"] as const;

const generators: ToolDef = {
  name: "studio_generators",
  title: "مولدات الاستوديو الإبداعي",
  description:
    "Lists the creative studio's generators the person can use (images, videos, voices, sound effects, music…): their id, the modes, the settings each takes (key, allowed values, default) and the prompt limit. Call it before studio_generate. Modes marked needs_files need uploaded reference files, which this connector cannot send yet: for those, give the person the studio link.",
  inputSchema: obj({ output: { type: "string", enum: OUTPUTS, description: "Only generators of this kind." } }),
  annotations: { readOnlyHint: true },
  run: async (a, c) => {
    const rt = await loadRuntime();
    const owner = isAdmin(c.user.email);
    const list = rt.generators
      .filter((g) => g.live || (owner && g.keyConfigured))
      .map((g) => ({ g, def: generatorById(g.id) }))
      .filter((x) => x.def && (!a.output || x.def.output === a.output))
      .map(({ g, def }) => ({
        id: g.id,
        name: g.name,
        output: def!.output,
        prompt: { label: def!.prompt.label, max: def!.prompt.max, arabic: def!.prompt.arabic },
        ...(def!.extraText ? { instructions: { label: def!.extraText.label, max: def!.extraText.max } } : {}),
        modes: def!.modes.map((m) => ({
          id: m.id,
          label: m.label,
          prompt_required: m.promptRequired,
          needs_files: Object.values(m.refs).some((r) => (r?.min ?? 0) > 0) || !!m.needsOneOf?.length,
        })),
        settings: def!.options.map((o) =>
          o.kind === "choice"
            ? { key: o.key, label: o.label, values: o.values.map((v) => v.value), labels: o.values.map((v) => v.label), default: o.default, ...(o.picker === "voice" ? { note: "a voice id from studio_voices" } : {}) }
            : o.kind === "int"
              ? { key: o.key, label: o.label, min: o.min, max: o.max, step: o.step ?? 1, default: o.default, unit: o.unit }
              : { key: o.key, label: o.label, type: "boolean", default: o.default },
        ),
      }));
    return { generators: list, studio: `${c.origin}/jawad-ai/creative` };
  },
};

const styles: ToolDef = {
  name: "studio_styles",
  title: "ستايلات الاستوديو",
  description: "Lists the style library (style_id, name, family, what it is best for) that studio_generate can apply to images and videos.",
  inputSchema: obj({ search: { type: "string", description: "Optional words to filter by (Arabic or English)." } }),
  annotations: { readOnlyHint: true },
  run: async (a) => {
    const q = str(a.search, 80).toLowerCase();
    const all = FILM_STYLES.map((s) => ({ style_id: s.id, name: s.name, family: s.group, school: s.school, best_for: s.bestFor }));
    const hit = q ? all.filter((s) => `${s.style_id} ${s.name} ${s.family} ${s.school} ${s.best_for}`.toLowerCase().includes(q)) : all;
    return { styles: hit.slice(0, 120), total: hit.length };
  },
};

const voices: ToolDef = {
  name: "studio_voices",
  title: "الأصوات",
  description: "Lists the voices a voice generator can speak with: ElevenLabs' ready voices and the person's own saved voices (use the id as the voice setting).",
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  run: async (_a, c) => callRoute(studioVoices.GET, { origin: c.origin, path: "/api/jawad/voices" }),
};

interface JobView {
  id: string;
  status: string;
  generatorName: string;
  priceCoins: number;
  error: string | null;
  outputs: { kind: string; url: string | null; downloadUrl: string; name: string | null }[];
}
const jobOut = (j: JobView, origin: string) => ({
  job_id: j.id,
  status: j.status,
  generator: j.generatorName,
  price: sar(j.priceCoins),
  ...(j.error ? { error: j.error } : {}),
  outputs: j.outputs.map((o) => ({ kind: o.kind, ...(o.name ? { name: o.name } : {}), url: o.url, download: o.downloadUrl?.startsWith("/") ? `${origin}${o.downloadUrl}` : o.downloadUrl })),
});

const generate: ToolDef = {
  name: "studio_generate",
  title: "توليد من الاستوديو",
  description:
    "Starts one generation in the creative studio (charged to the person's wallet at the site's price). ALWAYS call it first WITHOUT confirm_price_halalas: nothing is charged, and it returns the exact price. Tell the person the price, and only after they agree call it again with the same arguments plus confirm_price_halalas set to that price. Then poll studio_job_status until the job is done (videos take minutes). Settings keys and values come from studio_generators.",
  inputSchema: obj(
    {
      generator_id: { type: "string" },
      prompt: { type: "string", description: "What to make. Arabic is fine where the generator says so." },
      instructions: { type: "string", description: "Only for generators that take a second text (e.g. how a voice performs)." },
      settings: { type: "object", description: "Setting key → value, from studio_generators. Missing keys take the default.", additionalProperties: { type: ["string", "number", "boolean"] } },
      style_id: { type: "string", description: "Optional style from studio_styles (images and videos)." },
      confirm_price_halalas: { type: "integer", description: "The price the person agreed to, in halalas (from the first call)." },
    },
    ["generator_id", "prompt"],
  ),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const id = str(a.generator_id, 120);
    const rt = await loadRuntime();
    const g = rt.generators.find((x) => x.id === id);
    if (!g) throw new Error("ما لقينا هذا المولد. استخدم studio_generators.");
    const confirm = typeof a.confirm_price_halalas === "number" ? Math.round(a.confirm_price_halalas) : null;
    const settings = a.settings && typeof a.settings === "object" ? a.settings : {};
    const body = {
      sectionId: g.sectionId,
      generatorId: id,
      prompt: str(a.prompt, 40_000),
      instructions: str(a.instructions, 5_000),
      settings,
      ...(str(a.style_id, 120) ? { styleId: str(a.style_id, 120) } : {}),
      refStyle: "none",
      refs: [],
      expectedCoins: confirm ?? -1,
      // the same request repeated within ten minutes (a client's retry) is the same job, never a second charge
      idempotencyKey: `mcp-${createHash("sha256").update(JSON.stringify([c.user.id, id, a.prompt, a.instructions, settings, a.style_id, confirm, Math.floor(Date.now() / 600_000)])).digest("base64url").slice(0, 40)}`,
    };
    try {
      const r = await callRoute<{ job: JobView; created: boolean; balance: number | null }>(studioGenerate.POST, { origin: c.origin, path: "/api/jawad/generate", body, signal: c.signal });
      return { started: true, new_job: r.created, job: jobOut(r.job, c.origin), balance: sar(r.balance), next: "Call studio_job_status with this job_id until status is done or failed." };
    } catch (e) {
      const d = (e as { data?: Json }).data;
      if (d?.code === "price_changed") {
        return {
          started: false,
          needs_confirmation: true,
          price: sar(Number(d.coins)),
          price_halalas: d.coins,
          lines: d.lines,
          next: `Nothing was charged. Ask the person to approve ${sar(Number(d.coins))}; if they agree, call studio_generate again with the same arguments and confirm_price_halalas=${d.coins}.`,
        };
      }
      throw e;
    }
  },
};

const jobStatus: ToolDef = {
  name: "studio_job_status",
  title: "حالة التوليد",
  description: "The state of studio jobs (up to 30 ids): status, and when done the links to the results (images, videos, audio). Links last a short time; call again for fresh ones.",
  inputSchema: obj({ job_ids: { type: "array", items: { type: "string" }, maxItems: 30 } }, ["job_ids"]),
  annotations: { readOnlyHint: true },
  run: async (a, c) => {
    const ids = (Array.isArray(a.job_ids) ? a.job_ids : []).map(uuid).filter((x): x is string => !!x);
    const r = await callRoute<{ jobs: JobView[]; balance: number | null }>(studioJobs.GET, { origin: c.origin, path: "/api/jawad/jobs", query: { ids: ids.join(",") } });
    return { jobs: r.jobs.map((j) => jobOut(j, c.origin)), balance: sar(r.balance) };
  },
};

// ───────────────────────── «صانع الكاروسيل» (محمد باقر) ─────────────────────────

const contentLink = (origin: string, id: string) => `${origin}/jawad-ai/content?chat=${id}`;
const editorLink = (origin: string, e: { id: string; lab?: string }) => `${origin}/jawad-ai/editor/${e.id}${e.lab ? `?lab=${e.lab}` : ""}`;

const carouselChat: ToolDef = {
  name: "carousel_chat",
  title: "صانع الكاروسيل · محمد باقر",
  description:
    "Talks to «محمد باقر», JAWAD AI's carousel and content maker (Arabic). Send the person's request or answer as `message`; pass chat_id to continue the same conversation. He asks questions (shown in `questions`: relay them, or answer from what the person said), then plans the carousel. When `slides_to_draw` appears, call carousel_produce. When `media` appears, call carousel_media. A motion piece is handed to «حيدرة كت»: give the person `haidara_link`. Each reply is charged at the site's price.",
  inputSchema: obj({ message: { type: "string" }, chat_id: { type: "string", description: "To continue a conversation." } }, ["message"]),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const r = await callRoute<Json & { chatId: string; text: string; questions: unknown; pending: Json | null; editor: { id: string; title: string; lab?: string } | null; media: unknown; spent?: number }>(contentChat.POST, {
      origin: c.origin,
      path: "/api/content/chat",
      body: { chatId: uuid(a.chat_id), message: str(a.message, 20_000) },
      signal: c.signal,
    });
    return {
      chat_id: r.chatId,
      reply: r.text,
      ...(r.questions ? { questions: r.questions } : {}),
      ...(r.pending ? { slides_to_draw: r.pending, next: "Call carousel_produce with this chat_id (again while running is true)." } : {}),
      ...(r.media ? { media: r.media, media_next: "Call carousel_media with this chat_id (again while running is true)." } : {}),
      ...(r.editor ? { haidara_link: editorLink(c.origin, r.editor) } : {}),
      spent_in_chat: sar(r.spent),
      open_on_site: contentLink(c.origin, r.chatId),
    };
  },
};

const carouselProduce: ToolDef = {
  name: "carousel_produce",
  title: "رسم شرائح الكاروسيل",
  description:
    "Draws the next slides of the carousel «محمد باقر» planned (a few per call, charged at the site's price). Call again while `running` is true; then give the person the slide links. `retry` redraws given slide numbers or \"failed\". If `drawn_in_browser` is true, these slides are drawn in code on the site: give the person `open_on_site` and they continue there by themselves.",
  inputSchema: obj(
    {
      chat_id: { type: "string" },
      retry: { description: "Slide numbers to redraw, or \"failed\".", oneOf: [{ type: "string", enum: ["failed"] }, { type: "array", items: { type: "integer" } }] },
    },
    ["chat_id"],
  ),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const chatId = uuid(a.chat_id);
    if (!chatId) throw new Error("chat_id غير صحيح.");
    const r = await callRoute<Json & { slides: Json[]; failed: Json[]; running: boolean; total: number; todo: number[]; code?: unknown; spent?: number; report?: string | null }>(contentProduce.POST, {
      origin: c.origin,
      path: "/api/content/produce",
      body: { chatId, ...(a.retry !== undefined ? { retry: a.retry } : {}) },
      signal: c.signal,
    });
    return {
      running: r.running && !r.code,
      total: r.total,
      left: r.todo,
      slides: r.slides.map((s) => ({ n: s.n, url: s.url, download: s.download, ...(s.videoUrl ? { video: s.videoUrl, video_download: s.videoDownload } : {}) })),
      failed: r.failed,
      ...(r.report ? { report: r.report } : {}),
      ...(r.code ? { drawn_in_browser: true, note: "These slides are drawn in code in the browser: open the link and the site draws them by itself." } : {}),
      spent_in_chat: sar(r.spent),
      open_on_site: contentLink(c.origin, chatId),
    };
  },
};

const carouselMedia: ToolDef = {
  name: "carousel_media",
  title: "صور وفيديوهات محمد باقر",
  description: "Makes the pictures and videos «محمد باقر» handed over in a conversation (charged at the site's price). Call again while `running` is true, then give the person the links.",
  inputSchema: obj({ chat_id: { type: "string" }, retry_failed: { type: "boolean" } }, ["chat_id"]),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const chatId = uuid(a.chat_id);
    if (!chatId) throw new Error("chat_id غير صحيح.");
    const r = await callRoute<Json & { items: Json[]; running: boolean; spent?: number }>(contentMedia.POST, { origin: c.origin, path: "/api/content/generate", body: { chatId, ...(a.retry_failed ? { retry: "failed" } : {}) }, signal: c.signal });
    return { running: r.running, items: r.items.map((x) => ({ name: x.name, kind: x.kind, state: x.state, url: x.url, download: x.download, ...(x.error ? { error: x.error } : {}) })), spent_in_chat: sar(r.spent), open_on_site: contentLink(c.origin, chatId) };
  },
};

const carouselChats: ToolDef = {
  name: "carousel_conversations",
  title: "محادثاتي مع محمد باقر",
  description: "Without chat_id: the person's carousel conversations (id, title). With chat_id: that conversation's last messages and every slide link.",
  inputSchema: obj({ chat_id: { type: "string" } }),
  annotations: { readOnlyHint: true },
  run: async (a, c) => {
    const id = uuid(a.chat_id);
    if (!id) return callRoute(contentChats.GET, { origin: c.origin, path: "/api/content/chats" });
    const r = await callRoute<{ chat: Json & { messages: Json[] } }>(contentChats.GET, { origin: c.origin, path: "/api/content/chats", query: { id } });
    const messages = r.chat.messages.slice(-12).map((m) => ({
      role: m.role,
      text: typeof m.text === "string" ? m.text.slice(0, 3000) : "",
      ...(m.slides ? { slides: ((m.slides as { items: Json[] }).items ?? []).map((s) => ({ n: s.n, url: s.url, download: s.download, ...(s.videoUrl ? { video: s.videoUrl } : {}) })) } : {}),
      ...(m.media ? { media: ((m.media as { items: Json[] }).items ?? []).map((x) => ({ name: x.name, state: x.state, url: x.url })) } : {}),
    }));
    return { chat_id: id, title: r.chat.title, pending: r.chat.pending, messages, spent_in_chat: sar(Number(r.chat.spent)), open_on_site: contentLink(c.origin, id) };
  },
};

// ───────────────────────────── «المصمم الذكي» (كاظم) ─────────────────────────────

const designerLink = (origin: string, id: string) => `${origin}/jawad-ai/designer?chat=${id}`;

const designChat: ToolDef = {
  name: "designer_chat",
  title: "المصمم الذكي · كاظم",
  description:
    "Talks to «كاظم», JAWAD AI's designer (posters, posts, covers, ads; Arabic). Send the person's request or answer; pass chat_id to continue. When a design is ready to be drawn (`design_ready`), it is drawn by «حيدرا ماكس» in code on the site: give the person `open_on_site` — the page draws it by itself — and later read it back with designer_conversations. Each reply is charged at the site's price.",
  inputSchema: obj({ message: { type: "string" }, chat_id: { type: "string" } }, ["message"]),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const r = await callRoute<Json & { chatId: string; text: string; questions: unknown; pending: boolean; spent?: number }>(designerChat.POST, { origin: c.origin, path: "/api/designer/chat", body: { chatId: uuid(a.chat_id), message: str(a.message, 20_000) }, signal: c.signal });
    return {
      chat_id: r.chatId,
      reply: r.text,
      ...(r.questions ? { questions: r.questions } : {}),
      ...(r.pending ? { design_ready: true, next: "Give the person open_on_site: the design is drawn there by itself. Then designer_conversations shows the result." } : {}),
      spent_in_chat: sar(r.spent),
      open_on_site: designerLink(c.origin, r.chatId),
    };
  },
};

const designChats: ToolDef = {
  name: "designer_conversations",
  title: "تصاميمي",
  description: "Without chat_id: the person's design conversations. With chat_id: its last messages and the designs (final PNG and artwork links).",
  inputSchema: obj({ chat_id: { type: "string" } }),
  annotations: { readOnlyHint: true },
  run: async (a, c) => {
    const id = uuid(a.chat_id);
    if (!id) return callRoute(designerChats.GET, { origin: c.origin, path: "/api/designer/chats" });
    const r = await callRoute<{ chat: Json & { messages: Json[] } }>(designerChats.GET, { origin: c.origin, path: "/api/designer/chats", query: { id } });
    const messages = r.chat.messages.slice(-12).map((m) => {
      const d = m.design as Json | undefined;
      return { role: m.role, text: typeof m.text === "string" ? m.text.slice(0, 3000) : "", ...(d ? { design: { state: d.state, final: d.finalUrl ?? null, artwork: d.artworkUrl ?? null, ...(d.error ? { error: d.error } : {}) } } : {}) };
    });
    return { chat_id: id, title: r.chat.title, waiting_to_draw: r.chat.pending, messages, open_on_site: designerLink(c.origin, id) };
  },
};

// ───────────────────────────── «الطالب الذكي» (صادق) ─────────────────────────────

const studentLink = (origin: string, id: string) => `${origin}/jawad-ai/student/${id}`;

const studentNew: ToolDef = {
  name: "student_new",
  title: "مادة جديدة · الطالب الذكي",
  description:
    "Starts a new material in «الطالب الذكي» (JAWAD AI's study assistant «صادق») from a text the person gives (lesson, chapter, notes), with «صادق يكمل تلقائيًا» on. The study steps (reading, understanding, then outputs such as summaries, explanations, slides, quizzes, mind maps, recordings) continue on the site: give the person `open_on_site`. Follow it with student_materials.",
  inputSchema: obj(
    {
      title: { type: "string" },
      text: { type: "string", description: "The study text itself." },
      level: { type: "string", enum: [...LEVELS] },
      audience: { type: "string", description: "Who studies it (optional)." },
    },
    ["title", "text"],
  ),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const text = typeof a.text === "string" ? a.text.slice(0, 400_000) : "";
    if (!text.trim()) throw new Error("اكتب نص المادة.");
    const { id } = await callRoute<{ id: string }>(studentProjects.POST, { origin: c.origin, path: "/api/jawad/student/projects", body: { title: str(a.title, 200), level: str(a.level, 120), audience: str(a.audience, 300) } });
    const path = `/api/jawad/student/projects/${id}`;
    await callRoute(studentProject.POST, { origin: c.origin, path, params: { id }, body: { action: "source_text", body: text, name: str(a.title, 300) || "نص مكتوب" } });
    await callRoute(studentProject.POST, { origin: c.origin, path, params: { id }, body: { action: "auto", on: true } }).catch(() => null);
    return { project_id: id, open_on_site: studentLink(c.origin, id), next: "Give the person open_on_site: «صادق» goes on there (prices are shown before anything is charged)." };
  },
};

const studentList: ToolDef = {
  name: "student_materials",
  title: "موادي في الطالب الذكي",
  description: "Without project_id: the person's study materials. With project_id: its stage and outputs, with links to every finished file (PDF, PPTX, audio…).",
  inputSchema: obj({ project_id: { type: "string" } }),
  annotations: { readOnlyHint: true },
  run: async (a, c) => {
    const id = uuid(a.project_id);
    if (!id) {
      const r = await callRoute<{ projects: Json[] }>(studentProjects.GET, { origin: c.origin, path: "/api/jawad/student/projects" });
      return { materials: r.projects.map((p) => ({ project_id: p.id, title: p.title, stage: p.stage, open_on_site: studentLink(c.origin, String(p.id)) })) };
    }
    const s = await callRoute<{ project: Json; outputs: { id: string; kind: string; title: string; status: string; files: string[]; error: string | null }[] }>(studentProject.GET, { origin: c.origin, path: `/api/jawad/student/projects/${id}`, params: { id } });
    const outputs = await Promise.all(
      s.outputs.map(async (o) => ({
        kind: o.kind,
        title: o.title,
        status: o.status,
        ...(o.error ? { error: o.error } : {}),
        files: Object.fromEntries(await Promise.all(o.files.map(async (n) => [n, await outputFile(c.user.id, o.id, n).catch(() => null)] as const))),
      })),
    );
    return { project_id: id, title: s.project.title, stage: s.project.stage, outputs, open_on_site: studentLink(c.origin, id) };
  },
};

// ───────────────────────────── «حيدرة كت» (حيدرا ماكس) ─────────────────────────────

const KINDS = Object.keys(PROJECT_KINDS) as (keyof typeof PROJECT_KINDS)[];

const haidaraNew: ToolDef = {
  name: "haidara_new_project",
  title: "مشروع جديد في حيدرة كت",
  description:
    "Opens a new edit in «حيدرة كت», JAWAD AI's video editor, with the person's request handed to its assistant «حيدرا ماكس» (editing, captions, colour, and motion graphics he builds in code). Write the full brief: the goal, the text or script, the style, the length, the music. The editing, the motion and the export run in the browser: give the person `open_on_site` and «حيدرا ماكس» continues there from the brief. (For a motion piece planned with a storyboard, carousel_chat can also hand one over.)",
  inputSchema: obj(
    {
      title: { type: "string" },
      kind: { type: "string", enum: KINDS, description: "reel 9:16 (default), horizontal 16:9, podcast, poem." },
      brief: { type: "string", description: "Everything «حيدرا ماكس» should know and do, in the person's words." },
    },
    ["brief"],
  ),
  annotations: { openWorldHint: true },
  run: async (a, c) => {
    const brief = str(a.brief, 7800);
    if (!brief) throw new Error("اكتب الطلب.");
    const { id } = await callRoute<{ id: string }>(editorProjects.POST, { origin: c.origin, path: "/api/jawad/editor/projects", body: { title: str(a.title, 120), kind: KINDS.includes(a.kind as never) ? a.kind : "reel" } });
    // the brief is what حيدرا ماكس reads first at every answer (as محمد باقر hands a package over)
    const { error } = await createAdminClient()
      .from("editor_chats")
      .upsert({ project_id: id, user_id: c.user.id, messages: [], handoff: `طلب الشخص (من محادثته مع كلاود أو شات جي بي تي):\n${brief}`, chats: 1, updated_at: new Date().toISOString() });
    if (error) console.error("mcp haidara handoff", error.message);
    return { project_id: id, open_on_site: `${c.origin}/jawad-ai/editor/${id}`, brief_saved: !error, next: "Give the person open_on_site: they open it, add their clips if any, and tell «حيدرا ماكس» to start." };
  },
};

const haidaraList: ToolDef = {
  name: "haidara_projects",
  title: "مشاريعي في حيدرة كت",
  description: "The person's edits in «حيدرة كت» (id, title, kind) with the link that opens each.",
  inputSchema: obj({}),
  annotations: { readOnlyHint: true },
  run: async (_a, c) => {
    const r = await callRoute<{ projects: Json[] }>(editorProjects.GET, { origin: c.origin, path: "/api/jawad/editor/projects" });
    return { projects: r.projects.map((p) => ({ project_id: p.id, title: p.title, kind: p.kind, updated: p.updatedAt ?? p.updated_at, open_on_site: `${c.origin}/jawad-ai/editor/${p.id}` })) };
  },
};

export const TOOLS: ToolDef[] = [
  balance,
  generators,
  styles,
  voices,
  generate,
  jobStatus,
  carouselChat,
  carouselProduce,
  carouselMedia,
  carouselChats,
  designChat,
  designChats,
  studentNew,
  studentList,
  haidaraNew,
  haidaraList,
];
