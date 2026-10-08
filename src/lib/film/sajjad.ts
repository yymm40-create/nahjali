// «سجاد»: the film maker's consultant, in a film, a series of one person and a team's series. Each time he is asked
// he reads everything there is (the series' description, look, characters, places, episodes and scenes with their
// stage and who does them, the team, the scene's story and screenplay…) and his own notes — so he knows the whole
// work even for someone who never talked to him before. In a series, the people who may (its leader, or whom the
// leader gave «📖») develop it with him: he asks what's still needed (a few questions at a time, never all at once),
// rewrites the description, adds characters and places, and proposes a plan (episodes, scenes, who does which) that
// waits for «طبّق الخطة». Everyone else can ask him anything. Server only.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, callClaudeSearch, claudeCost, claudeTrouble, totalTokens, type ClaudeTurn } from "./anthropic";
import { addFindings, decideFindings, parseFindings, pendingFindings, readResearch, researchText, RESEARCH_LIMITS, type Research } from "./research";
import { addEpisode, addScene, canEditBible, episodesOf, membersOf, openSeries, scenesOf, usernames, type FilmSeries, type SeriesPlan } from "./series";
import { castOf, upsertCast } from "./series-cast";
import { seriesPaid } from "./series-pay";
import { getOwnedProject } from "./access";
import { failJob, startJob, succeedJob } from "./usage";
import { rightsText } from "./team-rights";
import { FILM_STAGES } from "@config/film";
import type { FilmProject } from "./types";

const db = () => createAdminClient();

export const SAJJAD = { name: "سجاد", icon: "🧑‍🏫" } as const;
const MAX_MESSAGES = 80;
const MAX_MEMORY = 150;
const ESTIMATE_USD = 0.15;

export interface SajjadMessage {
  role: "user" | "sajjad";
  text: string;
  at: string;
  userId?: string;
  username?: string | null;
  questions?: { question: string; options: string[] }[];
  changes?: string[];
}

type Scope = { kind: "series"; series: FilmSeries; canEdit: boolean } | { kind: "film"; project: FilmProject; series: FilmSeries | null };
const scopeKey = (s: Scope) => (s.kind === "series" ? `series:${s.series.id}` : `film:${s.project.id}`);

async function loadChat(key: string): Promise<{ messages: SajjadMessage[]; memory: string[] }> {
  const { data } = await db().from("sajjad_chats").select("messages,memory").eq("scope", key).maybeSingle();
  return { messages: (data?.messages as SajjadMessage[] | undefined) ?? [], memory: (data?.memory as string[] | undefined) ?? [] };
}

async function saveChat(key: string, messages: SajjadMessage[], memory: string[]) {
  const { error } = await db().from("sajjad_chats").upsert({ scope: key, messages: messages.slice(-MAX_MESSAGES), memory: memory.slice(-MAX_MEMORY), updated_at: new Date().toISOString() });
  if (error) throw new UserError("سجاد يحتاج تجهيز قاعدة البيانات أول (ملف 0034).", 503);
}

const stageLabel = (k: string) => FILM_STAGES.find((s) => s.key === k)?.label ?? k;
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Everything about a series, in words (what سجاد reads before answering). */
export async function seriesContext(series: FilmSeries, o: { full: boolean } = { full: true }) {
  const [cast, episodes, scenes, members] = await Promise.all([castOf(series.id), episodesOf(series.id), scenesOf(series.id), membersOf(series.id)]);
  const { data: sceneRows } = await db().from("film_projects").select("id,story,assigned_to").eq("series_id", series.id);
  const extra = new Map(((sceneRows ?? []) as { id: string; story: string; assigned_to: string | null }[]).map((r) => [r.id, r]));
  const names = await usernames([series.user_id, ...[...extra.values()].flatMap((r) => (r.assigned_to ? [r.assigned_to] : []))]);
  const lines: string[] = [];
  lines.push(`# المسلسل: «${series.title}» (${series.mode === "team" ? "فريق" : "فردي"}، قائده @${names.get(series.user_id) ?? "؟"})`);
  lines.push("## الوصف المطوّر", series.bible?.trim() || (series.about ? `(فكرة أولية) ${series.about}` : "(لسه ما انكتب)"));
  lines.push("## الشكل (الستايل)", series.style?.trim() || "(لسه ما انحدد)");
  const people = cast.filter((c) => c.kind === "character");
  const places = cast.filter((c) => c.kind === "place");
  lines.push("## الشخصيات", people.length ? people.map((c) => `- ${c.name}${c.status === "ready" ? " [صورتها جاهزة]" : ""}: ${cut(c.description, o.full ? 700 : 250)}`).join("\n") : "(ولا شخصية بعد)");
  lines.push("## البيئات", places.length ? places.map((c) => `- ${c.name}${c.status === "ready" ? " [صورتها جاهزة]" : ""}: ${cut(c.description, o.full ? 500 : 200)}`).join("\n") : "(ولا بيئة بعد)");
  if (o.full) {
    lines.push("## الحلقات والمشاهد");
    for (const ep of episodes) {
      lines.push(`الحلقة ${ep.number}${ep.title ? ` «${ep.title}»` : ""}:`);
      const list = scenes.get(ep.id) ?? [];
      if (!list.length) lines.push("  (ولا مشهد بعد)");
      for (const s of list) {
        const x = extra.get(s.id);
        const who = x?.assigned_to ? ` · مسند لـ @${names.get(x.assigned_to) ?? "؟"}` : "";
        lines.push(`  - المشهد ${s.number} «${s.title}» · ${s.saved ? "مونتاجه محفوظ (المشهد الناجح)" : `في مرحلة: ${stageLabel(s.stage)}`}${who}${x?.story ? ` · قصته: ${cut(x.story, 300)}` : ""}`);
      }
    }
    if (series.mode === "team") {
      lines.push("## الفريق", members.length ? members.map((m) => `- @${m.username ?? "؟"}: ${rightsText(m)}`).join("\n") : "(ما فيه أعضاء بعد)");
    }
    if (series.pending_plan?.episodes?.length) lines.push("## خطة اقترحتها ولسه ما طُبّقت", JSON.stringify(series.pending_plan).slice(0, 4000));
  }
  const research = researchText(readResearch(series.research), o.full ? 6000 : 1500);
  if (research) lines.push("## بحث معتمد", research);
  return lines.join("\n");
}

/** A film (or a series' scene), in words: its story, facts, step, screenplay and the maps made so far. */
async function filmContext(project: FilmProject, series: FilmSeries | null) {
  const { data: vs } = await db().from("film_versions").select("kind,status,body,data,version").eq("project_id", project.id).in("kind", ["screenplay", "sheet_understanding", "dir_map"]).order("version", { ascending: true });
  const rows = (vs ?? []) as { kind: string; status: string; body: string; data: Record<string, unknown> }[];
  const latest = (k: string) => rows.filter((r) => r.kind === k && r.status === "approved").at(-1) ?? rows.filter((r) => r.kind === k).at(-1);
  const screenplay = latest("screenplay");
  const sheetMap = (latest("sheet_understanding")?.data.sheet_map as { id: string; name: string }[] | undefined) ?? [];
  const dirMap = (latest("dir_map")?.data.generation_map as { id: string; name: string }[] | undefined) ?? [];
  const lines = [
    `# ${series ? `مشهد ${project.scene_number ?? "؟"} من مسلسل «${series.title}»` : "فيلم"}: «${project.title}» · المرحلة الحالية: ${stageLabel(project.stage)}`,
    "## القصة كما كتبها صاحبها",
    project.story || "(فاضية)",
  ];
  if (project.fixed_facts) lines.push("## أشياء ثابتة", project.fixed_facts);
  const research = researchText(readResearch(project.research));
  if (research) lines.push("## بحث معتمد", research);
  if (screenplay) lines.push(`## السيناريو${screenplay.status === "approved" ? " (معتمد)" : " (آخر نسخة)"}`, cut(screenplay.body, 14000));
  if (sheetMap.length) lines.push("## خريطة الشيتات", sheetMap.map((m) => `- ${m.id}: ${m.name}`).join("\n"));
  if (dirMap.length) lines.push("## مقاطع المخرج", dirMap.map((m) => `- ${m.id}: ${m.name}`).join("\n"));
  if (series) lines.push("", await seriesContext(series, { full: false }));
  return lines.join("\n");
}

const PERSONA = `You are «سجاد» (Sajjad), the consultant and story partner of the people making this work in JAWAD AI's film studio («الفيلم السينمائي» / «المسلسل الذكي»). You are a person-like assistant named سجاد: never say you are Claude, an AI model or anything else — if asked who you are, you are سجاد, the studio's consultant.

Speak Gulf Arabic (warm, clear, short paragraphs; no lecturing). You KNOW the whole work from CONTEXT below and from YOUR NOTES: answer precisely from them (names, who does what, what each scene is about, what's decided and what isn't). When something isn't decided yet, say so plainly and suggest options. Never invent facts as if they were decided.

Your notes ("remember"): every time the person decides or tells you a fact about the work (a name, an age, a relationship, a rule of the world, a choice), add it as one short Arabic line. Don't repeat notes you already have.

«حيدرة» is the studio's editor (in «حيدرة كت»): you hand him each scene for its montage, and his reports come to you as messages starting «📨 وصلني من حيدرة» (what was made again or changed in a clip). Take them into account like your own notes.

Asking: when you need information, ask at most 4 questions at a time in "questions", each with 2–5 short suggested answers in "options" (the person can also write their own). Never demand everything at once: they can come back any time and continue.

Research ("research"): you can search the web to develop the story (real events, places, eras, customs, how things really work, science, names…). Do it ONLY when the person asks you to research (or says yes to your offer), and ONLY within the scope they set: put the scope in "research" as one clear Arabic paragraph of what to look for (their words plus what the story needs), and in "reply" say briefly that you are searching for it now. When they ask you to research but the scope is not clear enough, ask for it in "questions" first and leave "research" "". Otherwise "research" is "". The findings come back as cards the person approves or drops by hand; only the approved ones enter the work (CONTEXT shows them under «بحث معتمد») — never treat a pending finding as decided.`;

const SERIES_EDITOR = `This person MAY develop the series (they are its leader or the leader gave them the right). You can:
- "bible": when the description changes (they told you something new, or asked you to write/organize it), return the WHOLE developed description in Arabic, organized under headings: الفكرة · العالم والزمان والمكان · النبرة والجمهور · الشخصيات الرئيسية وعلاقاتها · الصراع والقوس الكبير · الحلقات (العدد المتوقع وموضوع كل حلقة إن عُرف) · قواعد ثابتة. Keep everything already decided; add the new; mark open points as «(لم يُحدَّد بعد)». Return "" when nothing changed.
- "style": the series' visual look in Arabic words (technique, colours, light, mood, references by description only — never names of real artists, studios or copyrighted works). "" when unchanged.
- "cast": characters and places to add or update (by exact name): kind "character" or "place", the Arabic name, and a rich Arabic description (for a character: age, build, face, hair, clothing, colours, personality, how they move and speak; for a place: era, layout, materials, light, mood, key props). Only when the person asks for them or clearly decided them.
- "plan": ONLY when they ask you to arrange/distribute the work (how many episodes, the scenes of each, who does which): episodes with number, title, summary and their scenes (title, a 2–4 line brief of what happens, and the assignee's @username from the team, or "" for nobody). It is a proposal: it waits for them to press «طبّق الخطة». Otherwise return {"note":"","episodes":[]}.`;

const SERIES_VIEWER = `This person may ASK you anything, but may not change the series' description, look, characters, places or plan (only its leader, or whom the leader gave the right). If they ask for such a change, tell them kindly who can do it, and you may suggest it in words. Return "" for bible and style, [] for cast, and {"note":"","episodes":[]} for plan.`;

const FILM_ONLY = `Here you are the consultant of one film (or one scene of a series): answer, explain, advise, and help them think about their story, screenplay, characters and shots. You change nothing yourself. Return "" for bible and style, [] for cast, and {"note":"","episodes":[]} for plan.`;

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "questions", "remember", "research", "bible", "style", "cast", "plan"],
  properties: {
    reply: str,
    research: str,
    questions: { type: "array", items: { type: "object", additionalProperties: false, required: ["question", "options"], properties: { question: str, options: { type: "array", items: str } } } },
    remember: { type: "array", items: str },
    bible: str,
    style: str,
    cast: { type: "array", items: { type: "object", additionalProperties: false, required: ["kind", "name", "description"], properties: { kind: { type: "string", enum: ["character", "place"] }, name: str, description: str } } },
    plan: {
      type: "object",
      additionalProperties: false,
      required: ["note", "episodes"],
      properties: {
        note: str,
        episodes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["number", "title", "summary", "scenes"],
            properties: {
              number: { type: "integer" },
              title: str,
              summary: str,
              scenes: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "brief", "assignee"], properties: { title: str, brief: str, assignee: str } } },
            },
          },
        },
      },
    },
  },
} as const;

interface Reply {
  reply: string;
  questions: { question: string; options: string[] }[];
  remember: string[];
  research: string;
  bible: string;
  style: string;
  cast: { kind: "character" | "place"; name: string; description: string }[];
  plan: SeriesPlan;
}

// ───────────── «بحث سجاد» ─────────────

const researchOf = (s: Scope) => readResearch(s.kind === "series" ? s.series.research : s.project.research);

/** Who may decide what enters the work: a film's people; in a series whoever may develop it. */
const canDecideResearch = (s: Scope) => s.kind === "film" || s.canEdit;

async function saveResearch(s: Scope, r: Research) {
  const table = s.kind === "series" ? "film_series" : "film_projects";
  const id = s.kind === "series" ? s.series.id : s.project.id;
  const { error } = await db().from(table).update({ research: r }).eq("id", id);
  if (error) throw new UserError("بحث سجاد يحتاج تجهيز قاعدة البيانات أول (ملف 0037).", 503);
}

/** The state of research in words, for سجاد's system prompt. */
function researchState(s: Scope) {
  const r = researchOf(s);
  const pending = pendingFindings(r).length;
  const lines = [
    r.asked === "yes" ? "At the start the person said YES to research to develop the story: offer it and ask for the scope if they haven't set it." : r.asked === "no" ? "At the start the person said NO to research: don't push it; research only when they ask." : "",
    pending ? `${pending} finding(s) are still waiting for their decision (approve or drop) in the cards.` : "",
    canDecideResearch(s) ? "" : "This person may ask you to research, but approving findings into the work is for whoever may develop the series.",
  ].filter(Boolean);
  return lines.length ? `\n\n=== RESEARCH ===\n${lines.join("\n")}` : "";
}

/** سجاد searches the web within the scope and returns his findings as cards (pending). Costs are the caller's. */
async function runResearch(scope: string, context: string) {
  const r = await callClaudeSearch({
    system: `You research the web for a film / series story being developed in JAWAD AI's studio. Search reliable sources (reference works, histories, official bodies, reputable press, scholarship; Arabic sources when good ones exist). Keep STRICTLY to the scope the person set. Write in Arabic, as ${RESEARCH_LIMITS.findingsPerRun} findings at most, each starting with a line «## » + a short title, then 2–6 lines of what you found and how it could serve the story (concrete: dates, places, names, how things really work, telling details). Every fact must come from a source you found; when nothing reliable turns up for a part, say so in its finding instead of inventing. No introduction, no closing.`,
    prompt: `نطاق البحث الذي حدده صاحب العمل:\n${scope}\n\n=== العمل (للسياق فقط) ===\n${cut(context, 6000)}`,
    maxUses: 6,
    maxTokens: 6000,
  });
  return { findings: parseFindings(r.text, r.sources, scope), usd: r.usd };
}

/** «اعتمد» / «احذف» on findings: the approved ones enter the work from now on. */
export async function decideResearch(kind: unknown, id: unknown, userId: string, b: { approve?: unknown; drop?: unknown }) {
  const scope = await resolveScope(kind, id, userId);
  if (!canDecideResearch(scope)) throw new UserError("اعتماد نتائج البحث لقائد المسلسل أو اللي أعطاه صلاحية «📖».", 403);
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const r = decideFindings(researchOf(scope), ids(b.approve), ids(b.drop));
  await saveResearch(scope, r);
  const key = scopeKey(scope);
  const { messages, memory } = await loadChat(key);
  const approved = r.items.filter((f) => ids(b.approve).includes(f.id)).map((f) => `بحث معتمد: ${f.title}`);
  if (approved.length) await saveChat(key, messages, [...memory, ...approved.filter((m) => !memory.includes(m))]);
  return r;
}

/** The conversation for Claude: people's consecutive messages joined (with who wrote them), سجاد's answers. */
function turnsOf(messages: SajjadMessage[], text: string, me: string | null): ClaudeTurn[] {
  const all = [...messages.slice(-30), { role: "user", text, at: "", username: me } as SajjadMessage];
  const out: ClaudeTurn[] = [];
  for (const m of all) {
    const role = m.role === "user" ? "user" : "assistant";
    const line = m.role === "user" ? `${m.username ? `@${m.username}: ` : ""}${m.text}` : m.text + (m.questions?.length ? `\n(سألت: ${m.questions.map((q) => q.question).join(" / ")})` : "");
    const last = out.at(-1);
    if (last && last.role === role) last.content = `${last.content}\n\n${line}`;
    else out.push({ role, content: line });
  }
  if (out[0]?.role === "assistant") out.unshift({ role: "user", content: "(بداية المحادثة)" });
  return out;
}

async function resolveScope(kind: unknown, id: unknown, userId: string): Promise<Scope> {
  if (kind === "series") {
    const s = await openSeries(id, userId);
    if (!s) throw new UserError("ما لقينا هذا المسلسل.", 404);
    return { kind: "series", series: s.series, canEdit: await canEditBible(s.series, userId) };
  }
  if (kind === "film") {
    const project = await getOwnedProject(String(id), userId);
    const series = project.series_id ? ((await db().from("film_series").select("*").eq("id", project.series_id).maybeSingle()).data as FilmSeries | null) : null;
    return { kind: "film", project, series };
  }
  throw new UserError("طلب غير صحيح.", 400);
}

/** The conversation so far (and whether this person may develop the series with him). */
export async function sajjadChat(kind: unknown, id: unknown, userId: string) {
  const scope = await resolveScope(kind, id, userId);
  const { messages, memory } = await loadChat(scopeKey(scope));
  return { messages, memory, canEdit: scope.kind === "series" && scope.canEdit, plan: scope.kind === "series" ? (scope.series.pending_plan ?? null) : null, research: researchOf(scope), canDecide: canDecideResearch(scope) };
}

/** One question or message to سجاد: he answers from everything he knows and (where allowed) develops the series. */
export async function askSajjad(kind: unknown, id: unknown, user: { id: string; email?: string | null }, rawText: unknown) {
  const text = String(rawText ?? "").trim().slice(0, 6000);
  if (!text) throw new UserError("اكتب سؤالك أو ردّك.", 400);
  const scope = await resolveScope(kind, id, user.id);
  const key = scopeKey(scope);
  const { messages, memory } = await loadChat(key);
  const me = (await usernames([user.id])).get(user.id) ?? null;
  const context = scope.kind === "series" ? await seriesContext(scope.series) : await filmContext(scope.project, scope.series);
  const rules = scope.kind === "film" ? FILM_ONLY : scope.canEdit ? SERIES_EDITOR : SERIES_VIEWER;
  const system = `${PERSONA}\n\n${rules}${researchState(scope)}\n\n=== CONTEXT (read fresh each time) ===\n${context}\n\n=== YOUR NOTES ===\n${memory.length ? memory.map((m) => `- ${m}`).join("\n") : "(none yet)"}`;
  // his answer, and — when he was asked to research — the search itself, paid together
  const call = async () => {
    const r = await callClaudeJson<Reply>({ system, turns: turnsOf(messages, text, me), schema: SCHEMA, maxTokens: 16000, effort: "medium" });
    let usd = claudeCost(r.usage);
    let found: Research | null = null;
    const scopeText = r.data.research.trim().slice(0, RESEARCH_LIMITS.scopeMax);
    if (scopeText) {
      const s = await runResearch(scopeText, context);
      usd += s.usd;
      found = addFindings(researchOf(scope), s.findings);
    }
    return { value: { ...r, found }, usd };
  };
  let r: Awaited<ReturnType<typeof call>>["value"];
  try {
    if (scope.kind === "series") {
      r = await seriesPaid(scope.series, user, ESTIMATE_USD, "سؤال لسجاد", call);
    } else {
      // a film's (or scene's) question is one of its jobs: its owner, or the team series it belongs to, pays
      const { job } = await startJob({ projectId: scope.project.id, user, service: "anthropic", operation: "sajjad", idempotencyKey: `sajjad:${crypto.randomUUID()}`, estimateUsd: ESTIMATE_USD, units: 0, unit: "tokens" });
      try {
        const got = await call();
        r = got.value;
        await succeedJob(job.id, { costUsd: got.usd, units: totalTokens(r.usage) });
      } catch (e) {
        await failJob(job.id, e);
        throw e;
      }
    }
  } catch (e) {
    if (e instanceof UserError) throw e;
    console.error("sajjad failed", e);
    throw new UserError(claudeTrouble(e) ?? "سجاد ما قدر يرد الحين؛ جرّب مرة ثانية.", 502);
  }
  const d = r.data;
  const changes = scope.kind === "series" && scope.canEdit ? await applySeries(scope.series, d) : [];
  if (r.found) {
    await saveResearch(scope, r.found);
    const n = pendingFindings(r.found).length;
    changes.push(n ? `🔎 جبت ${n} نتائج بحث تنتظر اعتمادك` : "🔎 بحثت وما لقيت شي يُعتمد");
  }
  const now = new Date().toISOString();
  const next: SajjadMessage[] = [
    ...messages,
    { role: "user", text, at: now, userId: user.id, username: me },
    { role: "sajjad", text: d.reply.trim(), at: now, questions: d.questions.slice(0, 4).map((q) => ({ question: q.question, options: q.options.slice(0, 5) })), ...(changes.length ? { changes } : {}) },
  ];
  const known = new Set(memory);
  const notes = [...memory, ...d.remember.map((m) => m.trim()).filter((m) => m && !known.has(m))];
  await saveChat(key, next, notes);
  return { message: next.at(-1)!, changes, plan: scope.kind === "series" && scope.canEdit && d.plan.episodes.length ? d.plan : null, research: r.found };
}

/** What سجاد decided with an allowed person, written into the series. Returns the changes, in words. */
async function applySeries(series: FilmSeries, d: Reply) {
  const changes: string[] = [];
  const patch: Record<string, unknown> = {};
  if (d.bible.trim()) {
    patch.bible = d.bible.trim().slice(0, 30000);
    changes.push("📖 حدّثت وصف المسلسل");
  }
  if (d.style.trim()) {
    patch.style = d.style.trim().slice(0, 4000);
    changes.push("🎨 حدّثت شكل المسلسل");
  }
  if (d.plan.episodes.length) {
    patch.pending_plan = { note: d.plan.note, episodes: d.plan.episodes.slice(0, 60) };
    changes.push(`📋 اقترحت خطة (${d.plan.episodes.length} حلقات) تنتظر «طبّق الخطة»`);
  }
  if (Object.keys(patch).length) await db().from("film_series").update(patch).eq("id", series.id);
  if (typeof patch.style === "string") await upsertCast(series, { kind: "style", description: patch.style }).catch(() => {});
  for (const c of d.cast.slice(0, 20)) {
    try {
      await upsertCast(series, c);
      changes.push(`${c.kind === "character" ? "🧑 شخصية" : "🏞️ بيئة"} «${c.name}»`);
    } catch (e) {
      if (!(e instanceof UserError)) throw e;
    }
  }
  return changes;
}

/** «طبّق الخطة»: سجاد's proposed episodes and scenes are made (nothing already there is touched or repeated). */
export async function applyPlan(series: FilmSeries, userId: string) {
  if (!(await canEditBible(series, userId))) throw new UserError("الخطة يطبقها قائد المسلسل أو اللي أعطاه الصلاحية.", 403);
  const plan = series.pending_plan;
  if (!plan?.episodes?.length) throw new UserError("ما فيه خطة مقترحة. اطلب من سجاد يرتّب لك الحلقات والمشاهد.", 409);
  const members = await membersOf(series.id);
  const owner = (await usernames([series.user_id])).get(series.user_id);
  const idOf = (u: string) => {
    const name = u.replace(/^@/, "").trim();
    if (!name) return null;
    if (name === owner) return series.user_id;
    return members.find((m) => m.username === name)?.userId ?? null;
  };
  let episodes = await episodesOf(series.id);
  let madeEps = 0;
  let madeScenes = 0;
  const scenes = await scenesOf(series.id);
  for (const pe of [...plan.episodes].sort((a, b) => a.number - b.number)) {
    while (!episodes.some((e) => e.number === pe.number) && episodes.length < 100 && (episodes.at(-1)?.number ?? 0) < pe.number) {
      await addEpisode(series, (episodes.at(-1)?.number ?? 0) + 1 === pe.number ? pe.title : "");
      madeEps++;
      episodes = await episodesOf(series.id);
    }
    const ep = episodes.find((e) => e.number === pe.number);
    if (!ep) continue;
    if (!ep.title && pe.title) await db().from("film_episodes").update({ title: pe.title.slice(0, 80) }).eq("id", ep.id);
    const have = scenes.get(ep.id) ?? [];
    for (const ps of pe.scenes) {
      if (have.some((h) => h.title === ps.title)) continue;
      const sceneId = await addScene(series, { episodeId: ep.id, title: ps.title, story: ps.brief });
      const who = idOf(ps.assignee);
      if (who) await db().from("film_projects").update({ assigned_to: who }).eq("id", sceneId);
      madeScenes++;
    }
  }
  await db().from("film_series").update({ pending_plan: null }).eq("id", series.id);
  return { episodes: madeEps, scenes: madeScenes };
}

/** Throws away سجاد's proposed plan. */
export async function dropPlan(series: FilmSeries, userId: string) {
  if (!(await canEditBible(series, userId))) throw new UserError("هذا لقائد المسلسل أو اللي أعطاه الصلاحية.", 403);
  await db().from("film_series").update({ pending_plan: null }).eq("id", series.id);
}

// ───────────── a scene, the easy way: written by the person or by سجاد, understood, confirmed ─────────────

const SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "story", "understanding", "characters", "places", "questions"],
  properties: {
    title: str,
    story: str,
    understanding: str,
    characters: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "existing", "note"], properties: { name: str, existing: { type: "boolean" }, note: str } } },
    places: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "existing", "note"], properties: { name: str, existing: { type: "boolean" }, note: str } } },
    questions: SCHEMA.properties.questions,
  },
} as const;

export interface SceneUnderstanding {
  title: string;
  story: string;
  understanding: string;
  characters: { name: string; existing: boolean; note: string }[];
  places: { name: string; existing: boolean; note: string }[];
  questions: { question: string; options: string[] }[];
}

/**
 * سجاد reads a scene (the person's own text) or writes it (from the series, the episode, the scenes before it and
 * the person's wish), then says what he understood: what happens, which of the series' characters and places are in
 * it (by their exact names) and which are new, and what's still unclear. Nothing is saved until it's confirmed.
 */
export async function sceneUnderstand(series: FilmSeries, who: { id: string; email?: string | null }, b: { episodeId?: unknown; sceneId?: unknown; mode?: unknown; text?: unknown; title?: unknown; correction?: unknown }) {
  const mode = b.mode === "sajjad" ? "sajjad" : "mine";
  const text = String(b.text ?? "").trim().slice(0, 20000);
  if (mode === "mine" && text.length < 10) throw new UserError("اكتب المشهد أول (ولو بأسطر قليلة)، أو اختر «خل سجاد يكتبه».", 400);
  const episodes = await episodesOf(series.id);
  const ep = episodes.find((e) => e.id === b.episodeId);
  if (!ep) throw new UserError("ما لقينا هذي الحلقة.", 404);
  const scenes = (await scenesOf(series.id)).get(ep.id) ?? [];
  const { data: rows } = await db().from("film_projects").select("id,title,story,scene_number").eq("episode_id", ep.id).order("scene_number", { ascending: true });
  const before = ((rows ?? []) as { id: string; title: string; story: string; scene_number: number }[]).filter((r) => r.id !== b.sceneId);
  const current = b.sceneId ? scenes.find((s) => s.id === b.sceneId) : null;
  const number = current?.number ?? (scenes.at(-1)?.number ?? 0) + 1;
  const memory = (await loadChat(`series:${series.id}`)).memory;
  const ask = [
    `الحلقة ${ep.number}${ep.title ? ` «${ep.title}»` : ""} · المشهد ${number}${b.title ? ` «${String(b.title).slice(0, 80)}»` : ""}`,
    before.length ? `المشاهد الثانية في الحلقة:\n${before.map((r) => `- ${r.scene_number}. ${r.title}: ${cut(r.story, 400)}`).join("\n")}` : "",
    mode === "mine" ? `نص المشهد كما كتبه صاحبه:\n${text}` : `اكتب أنت هذا المشهد${text ? `، وهذا اللي يبيه صاحبه: ${text}` : " بحسب وصف المسلسل وخطة الحلقة"}.`,
    b.correction ? `تصحيح صاحب المشهد لفهمك السابق:\n${String(b.correction).slice(0, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const system = `${PERSONA}

Now you prepare ONE scene of the series for production. ${
    mode === "mine"
      ? 'The person wrote the scene: keep their text as it is in "story" (fix nothing, add nothing).'
      : 'Write the scene yourself in "story": Arabic prose of what happens, beat by beat, with the gist of the dialogue (who says what), 120–400 words, true to the series, its characters and the episode.'
  }
"title": a short scene title (keep the person's if given).
"understanding": 3–6 short Arabic lines: what happens, where, who, the mood, how it ends.
"characters" and "places": everyone and everywhere in the scene. For each one that is already in the series (CONTEXT lists them), use its EXACT name and existing=true; a new one: existing=false and a short Arabic description in "note" (for existing ones, "note" is what they do in this scene).
"questions": only what is really unclear (0–3), with suggested answers.

=== CONTEXT ===
${await seriesContext(series)}

=== YOUR NOTES ===
${memory.length ? memory.map((m) => `- ${m}`).join("\n") : "(none)"}`;
  try {
    return await seriesPaid(series, who, ESTIMATE_USD, "سجاد يجهّز مشهد", async () => {
      const r = await callClaudeJson<SceneUnderstanding>({ system, turns: [{ role: "user", content: ask }], schema: SCENE_SCHEMA, maxTokens: 12000, effort: "medium" });
      const d = r.data;
      if (mode === "mine") d.story = text;
      return { value: { ...d, number }, usd: claudeCost(r.usage) };
    });
  } catch (e) {
    if (e instanceof UserError) throw e;
    console.error("sajjad scene failed", e);
    throw new UserError(claudeTrouble(e) ?? "سجاد ما قدر يجهّز المشهد الحين؛ جرّب مرة ثانية.", 502);
  }
}

/**
 * «صح، كمّل»: the scene is made (or an existing one prepared) with its story, and with what the screenwriter must keep:
 * the series, its look, and the scene's characters and places as the series describes them (their pictures are reused
 * by the sheet maker). New characters and places can be added to the series at the same time.
 */
export async function confirmScene(series: FilmSeries, userId: string, b: { episodeId?: unknown; sceneId?: unknown; title?: unknown; story?: unknown; understanding?: unknown; characters?: unknown; places?: unknown; addNew?: unknown }) {
  const story = String(b.story ?? "").trim().slice(0, 20000);
  if (story.length < 10) throw new UserError("المشهد فاضي.", 400);
  const list = (v: unknown) => (Array.isArray(v) ? v : []).filter((x): x is { name: string; existing: boolean; note: string } => !!x && typeof x === "object" && typeof (x as { name?: unknown }).name === "string").slice(0, 30);
  const chars = list(b.characters);
  const places = list(b.places);
  // new characters and places join the series (when this person may add them)
  if (b.addNew === true && (await canEditBible(series, userId))) {
    for (const c of chars.filter((x) => !x.existing)) await upsertCast(series, { kind: "character", name: c.name, description: c.note }).catch(() => {});
    for (const p of places.filter((x) => !x.existing)) await upsertCast(series, { kind: "place", name: p.name, description: p.note }).catch(() => {});
  }
  const cast = await castOf(series.id);
  const used = cast.filter((c) => (c.kind === "character" && chars.some((x) => x.name === c.name)) || (c.kind === "place" && places.some((x) => x.name === c.name)));
  const episodes = await episodesOf(series.id);
  const ep = episodes.find((e) => e.id === b.episodeId);
  if (!ep) throw new UserError("ما لقينا هذي الحلقة.", 404);

  let sceneId = typeof b.sceneId === "string" && b.sceneId ? b.sceneId : null;
  if (!sceneId) sceneId = await addScene(series, { episodeId: ep.id, title: b.title, story });
  const { data: row } = await db().from("film_projects").select("scene_number,stage").eq("id", sceneId).eq("series_id", series.id).maybeSingle();
  if (!row) throw new UserError("ما لقينا المشهد.", 404);

  // what the screenwriter must keep, the scene's own people and places first (5000 characters at most)
  const head = `هذا المشهد ${row.scene_number ?? "؟"} من الحلقة ${ep.number} في مسلسل «${series.title}».`;
  const people = used.filter((c) => c.kind === "character").map((c) => `- ${c.name}: ${cut(c.description, 500)}`);
  const where = used.filter((c) => c.kind === "place").map((c) => `- ${c.name}: ${cut(c.description, 400)}`);
  const fresh = [...chars, ...places].filter((x) => !used.some((c) => c.name === x.name)).map((x) => `- ${x.name} (جديد في المسلسل): ${cut(x.note, 300)}`);
  const parts = [
    head,
    people.length ? `شخصيات المشهد (من شخصيات المسلسل، بأسمائها هذي بالضبط):\n${people.join("\n")}` : "",
    where.length ? `بيئات المشهد (من بيئات المسلسل):\n${where.join("\n")}` : "",
    fresh.length ? `جديد في هذا المشهد:\n${fresh.join("\n")}` : "",
    b.understanding ? `فهم سجاد للمشهد (أكّده صاحبه):\n${String(b.understanding).slice(0, 1200)}` : "",
    series.style ? `شكل المسلسل: ${cut(series.style, 600)}` : "",
  ].filter(Boolean);
  let facts = parts.join("\n\n");
  const room = 4900 - facts.length;
  const world = series.bible?.trim() || series.about;
  if (world && room > 400) facts += `\n\nعن المسلسل:\n${cut(world, room - 20)}`;
  const patch: Record<string, unknown> = {
    story,
    fixed_facts: facts.slice(0, 5000),
    series_cast: { cast: used.map((c) => c.id), fresh: [...chars, ...places].filter((x) => !x.existing).map((x) => x.name) },
  };
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 80);
  // a scene already past the screenwriter keeps its story (it was approved); only its people and places are noted
  if (row.stage !== "screenwriter") {
    delete patch.story;
    delete patch.title;
  }
  const { error } = await db().from("film_projects").update(patch).eq("id", sceneId);
  if (error) throw error;
  return { id: sceneId };
}

// ───────────── «سجاد» ⇄ «حيدرة» ─────────────

/**
 * What سجاد hands حيدرة when the clips go to the montage: everything about the scene (story, screenplay, sheets,
 * each clip as the director planned it with its dialogue and the person's montage notes, what came back edited) and
 * his own notes. Read fresh every time حيدرة answers in the film's (or the episode's) edit.
 */
export async function sajjadBrief(target: { filmProjectId?: string | null; episodeId?: string | null }): Promise<string | null> {
  try {
    if (target.filmProjectId) {
      const { data } = await db().from("film_projects").select("*").eq("id", target.filmProjectId).maybeSingle();
      const project = data as FilmProject | null;
      if (!project) return null;
      const series = project.series_id ? ((await db().from("film_series").select("*").eq("id", project.series_id).maybeSingle()).data as FilmSeries | null) : null;
      const [context, clips, chat] = await Promise.all([filmContext(project, series), clipsText(project.id), loadChat(`film:${project.id}`).catch(() => ({ messages: [], memory: [] as string[] }))]);
      return [context, clips, chat.memory.length ? `## ملاحظات سجاد\n${chat.memory.map((m) => `- ${m}`).join("\n")}` : ""].filter(Boolean).join("\n\n").slice(0, 40_000);
    }
    if (target.episodeId) {
      const { data: ep } = await db().from("film_episodes").select("id,series_id,number,title").eq("id", target.episodeId).maybeSingle();
      if (!ep) return null;
      const { data: s } = await db().from("film_series").select("*").eq("id", ep.series_id).maybeSingle();
      if (!s) return null;
      const series = s as FilmSeries;
      const { data: scenes } = await db().from("film_projects").select("id,title,scene_number,story").eq("episode_id", ep.id).order("scene_number", { ascending: true });
      const lines = [`# الحلقة ${ep.number}${ep.title ? ` «${ep.title}»` : ""} من مسلسل «${series.title}»`, await seriesContext(series, { full: false }), "## مشاهد الحلقة"];
      for (const sc of (scenes ?? []) as { id: string; title: string; scene_number: number | null; story: string }[]) {
        lines.push(`### المشهد ${sc.scene_number ?? "؟"} «${sc.title}»`, cut(sc.story ?? "", 1200), await clipsText(sc.id));
      }
      const chat = await loadChat(`series:${series.id}`).catch(() => ({ messages: [], memory: [] as string[] }));
      if (chat.memory.length) lines.push("## ملاحظات سجاد", chat.memory.map((m) => `- ${m}`).join("\n"));
      return lines.join("\n").slice(0, 40_000);
    }
  } catch (e) {
    console.error("sajjad brief", e);
  }
  return null;
}

/** Each clip as the director planned it: its name, length, what happens (his analysis), the dialogue and notes. */
async function clipsText(projectId: string) {
  const [{ data: vs }, { data: assets }] = await Promise.all([
    db().from("film_versions").select("kind,status,ref_key,body,data,version").eq("project_id", projectId).in("kind", ["dir_map", "dir_generation"]).order("version", { ascending: true }),
    db().from("film_assets").select("ref_key,status,meta").eq("project_id", projectId).eq("kind", "video"),
  ]);
  const rows = (vs ?? []) as { kind: string; status: string; ref_key: string; body: string; data: Record<string, unknown> }[];
  const map = (rows.filter((r) => r.kind === "dir_map" && r.status === "approved").at(-1)?.data.generation_map as { id: string; name: string }[] | undefined) ?? [];
  if (!map.length) return "";
  const out = ["## المقاطع (بترتيب المخرج)"];
  for (const g of map) {
    const v = rows.filter((r) => r.kind === "dir_generation" && r.ref_key === g.id && r.status === "approved").at(-1);
    const vids = ((assets ?? []) as { ref_key: string; status: string; meta: Record<string, unknown> | null }[]).filter((a) => a.ref_key === g.id && a.status === "approved");
    const note = vids.map((a) => (typeof a.meta?.montage_note === "string" ? a.meta.montage_note : "")).filter(Boolean).join(" / ");
    const edited = vids.some((a) => a.meta?.edited || a.meta?.source === "jawad");
    const dialogue = (v?.data.dialogue_ar as { speaker: string; line: string }[] | undefined) ?? [];
    // the analysis without the hidden prompt block
    const analysis = (v?.body ?? "").replace(/```[\s\S]*?```/g, "").trim();
    out.push(
      `### ${g.id} · ${g.name}${v?.data.duration_sec ? ` · ${v.data.duration_sec} ث` : ""}${edited ? " · (رجع معدّل)" : ""}`,
      analysis ? cut(analysis, 1500) : "",
      dialogue.length ? `الحوار: ${dialogue.map((d) => `${d.speaker}: «${d.line}»`).join(" · ")}` : "",
      note ? `ملاحظة الشخص للمونتاج: ${note}` : "",
    );
  }
  return out.filter(Boolean).join("\n");
}

/** حيدرة (or «التعديل الذكي») tells سجاد what happened to a clip of this film: it shows in سجاد's chat and he remembers it. */
export async function tellSajjad(filmProjectId: string, text: string) {
  try {
    const key = `film:${filmProjectId}`;
    const { messages, memory } = await loadChat(key);
    const line = text.trim().slice(0, 1500);
    await saveChat(key, [...messages, { role: "sajjad", text: `📨 وصلني من حيدرة: ${line}`, at: new Date().toISOString() }], [...memory, `من حيدرة: ${line.slice(0, 300)}`]);
  } catch (e) {
    console.error("tell sajjad", e);
  }
}
