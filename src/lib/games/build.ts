// «صانع الألعاب الذكي» — «اصنع لي اللعبة»: the site builds the game designed in a conversation with «قنبر». Three steps, each
// inside one request so nothing outlives the server's time (the steps' route runs up to 800 s): the PLAN (startBuild), then the CODE and the PICTURES side by side
// (stepCode, stepArt — the page drives both and keeps asking until they are done). A step claims its part first, so two tabs
// never do it twice, and a part left «working» past GAME_BUILD.staleMs (a request cut off) may be claimed again. A page that
// fails the checks (complete document, nothing from outside, the scripts' syntax) goes back for a fix; an edit later rewrites a
// finished game at the client's word, under the same link. The person pays the model's usage (robotTurn, around each call) and
// each picture as an ordinary JAWAD job (the desk). Server only.

import { Script } from "node:vm";
import { UserError } from "@/lib/api";
import { unlimitedFor } from "@/lib/access";
import { deskImage, deskQuote, DeskError, type DeskWho } from "@/lib/content/jawad";
import { claudeTrouble, isLeader } from "@/lib/film/anthropic";
import { isAdmin } from "@config/site";
import { JAWAD_BUCKET } from "@/lib/jawad/server/runtime";
import { storage } from "@/lib/storage";
import { createAdminClient } from "@/lib/supabase/admin";
import { artPath, continueBrief, editBrief, codeBrief, fixBrief, joinParts, GAME_BUILD, GAME_CODE_RULES, GAME_PLAN_RULES, inlineScripts, keepErrors, pageProblems, pagePath, playPath, readPage, readPlan, SPRITE_BACKDROP, type AssetPlan, type GamePlan } from "@config/games-build";
import { backgroundFile, coverFile, spriteFile } from "./art";
import { talk, type Said } from "./claude";
import { cleanHistory, forModel, getChat } from "./chats";

const db = () => createAdminClient();
const T = "games_builds";

export type CodeState = "pending" | "writing" | "broken" | "done" | "failed";
export type ArtState = "pending" | "drawing" | "done";

interface ArtItem {
  state: "pending" | "done" | "failed";
  file?: string;
  tries: number;
  error?: string;
}

/** What the next code step does. */
interface CodeNote {
  job: "write" | "fix" | "edit" | "continue";
  /** fix: what failed */
  problems?: string[];
  /** fix: the job being fixed; continue: the job being continued */
  of?: "write" | "edit" | "fix";
  /** continue: the write or edit it all belongs to */
  base?: "write" | "edit";
  /** continue: how many times this answer was continued so far */
  parts?: number;
  /** edit: the client's words */
  change?: string;
}

interface Row {
  id: string;
  user_id: string;
  chat_id: string | null;
  title: string;
  summary: string;
  plan: GamePlan;
  art: Record<string, ArtItem>;
  html: string | null;
  draft: string | null;
  version: number;
  status: "building" | "ready" | "failed";
  code_state: CodeState;
  code_note: string;
  code_tries: number;
  code_started_at: string | null;
  art_state: ArtState;
  art_started_at: string | null;
  last_error: string;
  errors: unknown;
  usd: number;
  created_at: string;
}

/** A build as the page sees it. */
export interface BuildView {
  id: string;
  chatId: string | null;
  title: string;
  summary: string;
  status: Row["status"];
  code: CodeState;
  /** a finished game is being changed */
  editing: boolean;
  /** the code's writing stopped in the middle and is being continued from there */
  more: boolean;
  art: ArtState;
  pictures: { done: number; failed: number; total: number };
  cover: string | null;
  link: string;
  version: number;
  error: string;
  /** errors players ran into since the last fix */
  playerErrors: number;
  createdAt: string;
}

const now = () => new Date().toISOString();
const stale = (at: string | null) => !at || Date.now() - new Date(at).getTime() > GAME_BUILD.staleMs;
const readNote = (s: string): CodeNote => {
  try {
    const n = JSON.parse(s) as CodeNote;
    return n && (n.job === "write" || n.job === "fix" || n.job === "edit" || n.job === "continue") ? n : { job: "write" };
  } catch {
    return { job: "write" };
  }
};
const errorsOf = (r: Row) => (Array.isArray(r.errors) ? r.errors.filter((e): e is string => typeof e === "string") : []);

/** The table is not there yet (the owner has not run 0050): said plainly instead of a database error. */
function dbError(e: { code?: string; message?: string } | null): never {
  if (e && (e.code === "42P01" || e.code === "PGRST205" || /games_builds/.test(e.message ?? ""))) throw new UserError("«اصنع اللعبة» قيد التجهيز (قاعدة البيانات). جرّب بعد شوي.", 503);
  throw new Error(e?.message ?? "database error");
}

export function viewOf(r: Row): BuildView {
  const items = Object.entries(r.art ?? {});
  const cover = r.art?.cover;
  const editing = !!r.html && r.status === "ready" && (r.code_state === "pending" || r.code_state === "writing" || r.code_state === "broken");
  return {
    id: r.id,
    chatId: r.chat_id,
    title: r.title,
    summary: r.summary,
    status: r.status,
    code: r.code_state,
    editing,
    more: (r.code_state === "broken" || r.code_state === "writing") && readNote(r.code_note).job === "continue",
    art: r.art_state,
    pictures: { done: items.filter(([, a]) => a.state === "done").length, failed: items.filter(([, a]) => a.state === "failed").length, total: items.length },
    cover: cover?.state === "done" && cover.file ? artPath(r.id, cover.file) : null,
    link: playPath(r.id),
    version: r.version,
    error: r.last_error,
    playerErrors: errorsOf(r).length,
    createdAt: r.created_at,
  };
}

async function rowOf(userId: string, id: string): Promise<Row | null> {
  const { data, error } = await db().from(T).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) dbError(error);
  return (data as Row | null) ?? null;
}

async function update(id: string, patch: Partial<Row>) {
  const { error } = await db().from(T).update({ ...patch, updated_at: now() }).eq("id", id);
  if (error) dbError(error);
}

/** My builds: of one conversation (oldest first, as they were made), or all of them (newest first). */
export async function listBuilds(userId: string, chatId?: string | null): Promise<BuildView[]> {
  let q = db().from(T).select("*").eq("user_id", userId);
  q = chatId ? q.eq("chat_id", chatId).order("created_at", { ascending: true }) : q.order("created_at", { ascending: false });
  const { data, error } = await q.limit(60);
  if (error) dbError(error);
  return ((data ?? []) as Row[]).map(viewOf);
}

export async function getBuild(userId: string, id: string): Promise<BuildView | null> {
  const r = await rowOf(userId, id);
  return r ? viewOf(r) : null;
}

export async function deleteBuild(userId: string, id: string) {
  const r = await rowOf(userId, id);
  if (!r) return;
  await db().from(T).delete().eq("id", id).eq("user_id", userId);
  const files = Object.values(r.art ?? {}).flatMap((a) => (a.file ? [`games/${id}/${a.file}`] : []));
  if (files.length) await storage.from(JAWAD_BUCKET).remove(files).catch(() => null);
}

/** About what a build's pictures cost this person now (halalas; 0 when free, null when unknown). */
export async function picturesQuote(user: { id: string; email?: string | null }, origin: string): Promise<{ picture: number | null; cover: number | null; free: boolean }> {
  const free = await unlimitedFor(user.email);
  const who: DeskWho = { id: user.id, email: user.email, owner: free, origin };
  const [picture, cover] = await Promise.all([
    deskQuote(who, { kind: "image", prompt: "quote", aspect: "1:1", quality: "medium", resolution: "std" }),
    deskQuote(who, { kind: "image", prompt: "quote", aspect: "16:9", quality: "high", resolution: "std" }),
  ]);
  return { picture, cover, free };
}

// ———————————————————————————— the plan ————————————————————————————

/** «اصنع اللعبة»: «قنبر» plans the game of this conversation and the build is made (its code and pictures follow). */
export async function startBuild(user: { id: string; email?: string | null }, chatId: string, pictures: boolean): Promise<{ build: BuildView; usd: number }> {
  const chat = await getChat(user.id, chatId);
  if (!chat) throw new UserError("ما لقينا هذي المحادثة.", 404);
  if (!chat.messages.some((m) => m.role === "assistant")) throw new UserError("تكلّم مع قنبر عن لعبتك أول، وبعدين اضغط «اصنع اللعبة».");
  const { count, error } = await db().from(T).select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "building");
  if (error) dbError(error);
  if ((count ?? 0) >= GAME_BUILD.maxRunning) throw new UserError("عندك ألعاب تنبني الحين؛ انتظر وحدة منها تخلص وبعدين ابدأ الثانية.", 429);

  const turns = forModel(cleanHistory([...chat.messages, { role: "user", text: "اصنع اللعبة الحين: خطّطها كما في التعليمات." }]));
  const r = await talk({ system: GAME_PLAN_RULES, turns, maxTokens: GAME_BUILD.planTokens, effort: "medium", timeoutMs: 150_000, leader: isLeader(user.email) });
  const plan = readPlan(r.text, pictures);
  if (!plan) throw new UserError("ما قدر قنبر يجهّز خطة اللعبة هالمرة؛ جرّب مرة ثانية.", 502);
  const art: Record<string, ArtItem> = { cover: { state: "pending", tries: 0 } };
  for (const a of plan.assets) art[a.id] = { state: "pending", tries: 0 };
  const { data, error: e2 } = await db()
    .from(T)
    .insert({ user_id: user.id, chat_id: chatId, title: plan.title, summary: plan.summary, plan, art, code_note: JSON.stringify({ job: "write" } satisfies CodeNote), usd: r.usd })
    .select("*")
    .single();
  if (e2) dbError(e2);
  return { build: viewOf(data as Row), usd: r.usd };
}

// ———————————————————————————— the code ————————————————————————————

/** The scripts' syntax, checked by compiling them (nothing runs). */
export function syntaxProblems(page: string): string[] {
  const scripts = inlineScripts(page);
  const out: string[] = [];
  scripts.forEach((src, i) => {
    try {
      new Script(src, { filename: `game-${i + 1}.js` });
    } catch (e) {
      const err = e as Error;
      const line = new RegExp(`game-${i + 1}\\.js:(\\d+)`).exec(String(err.stack ?? ""))?.[1];
      out.push(`JavaScript ${err.name ?? "error"} in the inline script${scripts.length > 1 ? ` #${i + 1}` : ""}${line ? ` at its line ${line}` : ""}: ${err.message}`);
    }
  });
  return out;
}

/** Everything that keeps a page from being served. */
export const checkPage = (page: string, ids: string[]) => [...pageProblems(page, ids), ...syntaxProblems(page)];

/** Claims the code part: true when this request does it. */
async function claim(r: Row, part: "code" | "art"): Promise<boolean> {
  const state = part === "code" ? r.code_state : r.art_state;
  const started = part === "code" ? r.code_started_at : r.art_started_at;
  const busy = part === "code" ? "writing" : "drawing";
  let q = db()
    .from(T)
    .update(part === "code" ? { code_state: "writing", code_started_at: now(), updated_at: now() } : { art_state: "drawing", art_started_at: now(), updated_at: now() })
    .eq("id", r.id)
    .eq(part === "code" ? "code_state" : "art_state", state);
  if (state === busy) q = started ? q.eq(part === "code" ? "code_started_at" : "art_started_at", started) : q.is(part === "code" ? "code_started_at" : "art_started_at", null);
  const { data, error } = await q.select("id");
  if (error) dbError(error);
  return !!data?.length;
}

/** Runs one call to the model the person pays for (robotTurn: the balance checked first, the usage taken after). */
export type Pay = <R extends { usd: number }>(run: () => Promise<R>) => Promise<R>;

/**
 * The code part, one step: writes the page (a new game), fixes the one that failed the checks, or changes a finished game
 * (`change`: the client's words; empty with player errors = fix them). Returns the build as it stands.
 */
export async function stepCode(user: { id: string; email?: string | null }, id: string, change: string | undefined, pay: Pay): Promise<BuildView> {
  let r = await rowOf(user.id, id);
  if (!r) throw new UserError("ما لقينا هذي اللعبة.", 404);

  if (change !== undefined) {
    if (!r.html || r.status !== "ready") throw new UserError("اللعبة لسا ما خلصت؛ انتظرها تجهز وبعدين عدّل.", 409);
    if ((r.code_state === "writing" && !stale(r.code_started_at)) || r.code_state === "pending" || r.code_state === "broken") throw new UserError("في تعديل شغّال على اللعبة الحين؛ انتظره يخلص.", 409);
    const words = change.trim().slice(0, GAME_BUILD.changeMax);
    if (!words && !errorsOf(r).length) throw new UserError("اكتب وش التعديل اللي تبيه.");
    const { data, error } = await db()
      .from(T)
      .update({ code_state: "pending", code_note: JSON.stringify({ job: "edit", change: words } satisfies CodeNote), code_tries: 0, draft: null, last_error: "", updated_at: now() })
      .eq("id", id)
      .eq("code_state", r.code_state)
      .select("*");
    if (error) dbError(error);
    if (!data?.length) throw new UserError("في تعديل شغّال على اللعبة الحين؛ انتظره يخلص.", 409);
    r = data[0] as Row;
  }

  const open = r.code_state === "pending" || r.code_state === "broken" || (r.code_state === "writing" && stale(r.code_started_at));
  if (!open || !(await claim(r, "code"))) return viewOf((await rowOf(user.id, id)) ?? r);

  const note = readNote(r.code_note);
  const plan = r.plan;
  const ids = plan.assets.map((a) => a.id);
  const errors = errorsOf(r);
  // a continued answer goes on with the job it belongs to (a fix's own job, or the write/edit it fixes)
  const job = note.job === "continue" ? (note.of ?? "write") : note.job;
  const base: "write" | "edit" = note.job === "continue" ? (note.base ?? (job === "edit" ? "edit" : "write")) : note.job === "fix" ? (note.of === "edit" ? "edit" : "write") : note.job === "edit" ? "edit" : "write";
  const going = note.job === "continue" && !!r.draft;
  const brief = going ? continueBrief(plan, r.draft!) : note.job === "fix" && r.draft ? fixBrief(plan, r.draft, note.problems ?? []) : base === "edit" && r.html ? editBrief(plan, r.html, note.change ?? "", errors) : codeBrief(plan);
  const tries = r.code_tries + 1;
  const again: CodeState = (note.job === "fix" || going) && r.draft ? "broken" : "pending";

  let said: Said;
  try {
    said = await pay(() => talk({ system: GAME_CODE_RULES, turns: [{ role: "user", text: brief }], maxTokens: GAME_BUILD.codeTokens, effort: "medium", timeoutMs: GAME_BUILD.timeoutMs, leader: isLeader(user.email), stream: true, keepPartial: true }));
  } catch (e) {
    // nothing was tried (the balance, for one): the job waits as it was, and the person is told why
    if (e instanceof UserError) {
      await update(id, { code_state: again, last_error: e.message });
      throw e;
    }
    // the model could not answer this time (already tried again for a passing failure): the same job stays to be done
    // (each try counts); the reason is said plainly, and the owner also sees the service's own words
    console.error("games build code", id, e);
    const raw = e instanceof Error ? e.message : String(e);
    await giveUpOr(r, tries, { code_state: again }, `${claudeTrouble(e) ?? "ما قدر قنبر يكمل كود اللعبة هالمرة، وبنعيد المحاولة."}${isAdmin(user.email) ? ` (تفصيل للرئيس: ${raw.slice(0, 300)})` : ""}`);
    return viewOf((await rowOf(user.id, id)) ?? r);
  }

  const text = going ? joinParts(r.draft!, said.text) : said.text;
  const spent = Number(r.usd ?? 0) + said.usd;
  const parts = going ? (note.parts ?? 1) + 1 : 1;
  // it stopped in the middle (out of length, or cut off): the next step goes on from there — it is not a failed try
  if ((said.stop === "max_tokens" || said.stop === "cut") && parts <= GAME_BUILD.maxContinues && !/<\/html\s*>/i.test(said.text) && text.length < GAME_BUILD.maxHtml) {
    await update(id, { code_state: "broken", draft: text, code_note: JSON.stringify({ job: "continue", of: job, base, parts, problems: note.problems, change: note.change } satisfies CodeNote), usd: spent, last_error: "" });
    return viewOf((await rowOf(user.id, id)) ?? r);
  }

  const page = readPage(text);
  const problems = page ? checkPage(page, ids) : [];
  if (page && !problems.length) {
    // a good page: served from now on (a fix or an edit also clears what players ran into)
    await update(id, { html: page, draft: null, version: r.version + 1, code_state: "done", code_note: "", code_tries: 0, last_error: "", errors: base === "edit" ? [] : r.errors, usd: spent });
    await finish(id);
  } else if (!page) {
    await giveUpOr(r, tries, { code_state: again, usd: spent }, "رد قنبر طلع ناقص، وبنعيد المحاولة.");
  } else {
    await giveUpOr(r, tries, { code_state: "broken", draft: page, code_note: JSON.stringify({ job: "fix", of: base, problems, change: note.change } satisfies CodeNote), usd: spent }, "");
  }
  return viewOf((await rowOf(user.id, id)) ?? r);
}

/** Another try when there are tries left; else the build stops (a new game) or stays as it was (an edit). */
async function giveUpOr(r: Row, tries: number, retry: Partial<Row>, why: string) {
  if (tries <= GAME_BUILD.maxFixes) {
    await update(r.id, { ...retry, code_tries: tries, last_error: why });
    return;
  }
  const usd = retry.usd ?? r.usd;
  if (r.html) {
    await update(r.id, { code_state: "done", draft: null, code_note: "", code_tries: 0, usd, last_error: "ما قدرنا نطبّق التعديل هالمرة، واللعبة باقية مثل ما كانت. جرّب تكتب التعديل بطريقة ثانية." });
    return;
  }
  await update(r.id, { code_state: "failed", status: "failed", usd, last_error: "ما قدر قنبر يكمل كود اللعبة بدون أخطاء. اضغط «🔄 ابنها من جديد»." });
}

// ———————————————————————————— the pictures ————————————————————————————

const fileName = (id: string, ext: string) => `${id}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

/** One picture: drawn by جواد, made ready for the game (a sprite cut out), and kept with the build. Returns its file name. */
async function drawOne(who: DeskWho, buildId: string, a: AssetPlan | { id: "cover"; kind: "cover"; aspect: "16:9"; prompt: string }, attempt: number): Promise<string> {
  const sprite = a.kind === "sprite";
  const r = await deskImage(who, {
    key: `game-${buildId}-${a.id}-${attempt}`,
    kind: "image",
    prompt: sprite ? `${a.prompt}\n\n${SPRITE_BACKDROP}` : a.prompt,
    aspect: a.aspect,
    quality: a.kind === "cover" ? "high" : "medium",
    resolution: "std",
  });
  const body = a.kind === "cover" ? await coverFile(r.bytes) : sprite ? await spriteFile(r.bytes) : await backgroundFile(r.bytes);
  const ext = a.kind === "cover" ? "jpg" : "webp";
  const name = fileName(a.id, ext);
  const up = await storage.from(JAWAD_BUCKET).upload(`games/${buildId}/${name}`, body, { contentType: ext === "jpg" ? "image/jpeg" : "image/webp", upsert: true });
  if (up.error) throw new DeskError("ما قدرنا نحفظ الصورة.", up.error.message, true);
  return name;
}

/** The pictures part, one step: every picture still to draw, side by side. */
export async function stepArt(user: { id: string; email?: string | null }, id: string, origin: string): Promise<BuildView> {
  const r = await rowOf(user.id, id);
  if (!r) throw new UserError("ما لقينا هذي اللعبة.", 404);
  const open = r.art_state === "pending" || (r.art_state === "drawing" && stale(r.art_started_at));
  if (!open || !(await claim(r, "art"))) return viewOf((await rowOf(user.id, id)) ?? r);

  const who: DeskWho = { id: user.id, email: user.email, owner: await unlimitedFor(user.email), origin };
  const art: Record<string, ArtItem> = { ...(r.art ?? {}) };
  const wanted = [{ id: "cover" as const, kind: "cover" as const, aspect: "16:9" as const, prompt: r.plan.cover }, ...r.plan.assets].filter((a) => (art[a.id]?.state ?? "pending") === "pending");
  // each picture is kept as soon as it is drawn (one writer: this request)
  let saving = Promise.resolve();
  const save = () => {
    saving = saving.then(() => update(id, { art: { ...art } })).catch((e) => console.error("games art save", id, e));
  };
  let why = "";
  await Promise.all(
    wanted.map(async (a) => {
      const item = art[a.id] ?? { state: "pending", tries: 0 };
      try {
        art[a.id] = { state: "done", file: await drawOne(who, id, a, item.tries), tries: item.tries };
      } catch (e) {
        const d = e instanceof DeskError ? e : new DeskError("تعذّر رسم الصورة.", String(e instanceof Error ? e.message : e), true);
        if (!(e instanceof DeskError)) console.error("games art", id, a.id, e);
        const tries = item.tries + 1;
        art[a.id] = { state: d.transient && tries < GAME_BUILD.assetTries ? "pending" : "failed", tries, error: d.reason };
        if (!d.transient && !why) why = d.reason;
      }
      save();
    }),
  );
  await saving;
  const left = Object.values(art).some((a) => a.state === "pending");
  await update(id, { art, art_state: left ? "pending" : "done", ...(why ? { last_error: `بعض الصور ما انرسمت (${why})، واللعبة تشتغل بدونها.` } : {}) });
  if (!left) await finish(id);
  return viewOf((await rowOf(user.id, id)) ?? r);
}

// ———————————————————————————— ready ————————————————————————————

/** Both parts done: the game is ready, and «قنبر» says so in the conversation (once). */
async function finish(id: string) {
  const { data } = await db().from(T).select("*").eq("id", id).maybeSingle();
  const r = data as Row | null;
  if (!r || r.status !== "building" || r.code_state !== "done" || r.art_state !== "done") return;
  const { data: flipped } = await db().from(T).update({ status: "ready", updated_at: now() }).eq("id", id).eq("status", "building").select("id");
  if (!flipped?.length || !r.chat_id) return;
  const { data: chat } = await db().from("games_chats").select("messages").eq("id", r.chat_id).maybeSingle();
  if (!chat) return;
  const said = `🎮 بنيت لك لعبة «${r.title}» وصارت جاهزة للعب! ${r.summary}\n\nبطاقتها تحت المحادثة: اضغط «▶ العب الحين»، أو انسخ الرابط وأرسله لربعك (${playPath(id)}). تبي تعدّل شي فيها؟ اضغط «✏️ عدّل» في البطاقة وقل لي وش تبي.`;
  const messages = [...(Array.isArray(chat.messages) ? chat.messages : []), { role: "assistant", text: said }];
  await db().from("games_chats").update({ messages, updated_at: now() }).eq("id", r.chat_id);
}

// ———————————————————————————— playing ————————————————————————————

/** A game as anyone with its link sees it (the page served, its pictures, its card). Null when there is no such game yet. */
export async function publicGame(id: string): Promise<{ title: string; summary: string; html: string | null; version: number; files: Record<string, string | null>; cover: string | null; ready: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db().from(T).select("title,summary,html,version,art,status").eq("id", id).maybeSingle();
  if (error || !data) return null;
  const art = (data.art ?? {}) as Record<string, ArtItem>;
  const files: Record<string, string | null> = {};
  for (const [k, a] of Object.entries(art)) files[k] = a.state === "done" && a.file ? artPath(id, a.file) : null;
  return { title: String(data.title ?? ""), summary: String(data.summary ?? ""), html: (data.html as string | null) ?? null, version: Number(data.version ?? 0), files, cover: files.cover ?? null, ready: data.status === "ready" || !!data.html };
}

/** A picture's bytes (only a file the build itself lists). */
export async function gameFile(id: string, file: string): Promise<Blob | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-z]{1,20}-[0-9a-f]{8}\.(webp|jpg)$/.test(file)) return null;
  const { data } = await db().from(T).select("art").eq("id", id).maybeSingle();
  const listed = Object.values((data?.art ?? {}) as Record<string, ArtItem>).some((a) => a.file === file);
  if (!listed) return null;
  const dl = await storage.from(JAWAD_BUCKET).download(`games/${id}/${file}`);
  return dl.data ?? null;
}

/** A player's browser reports an error in the game (kept, the last few, for the next fix). */
export async function reportError(id: string, message: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !message.trim()) return;
  const { data } = await db().from(T).select("errors,version").eq("id", id).maybeSingle();
  if (!data || !data.version) return;
  const errors = keepErrors(data.errors, message);
  if (JSON.stringify(errors) === JSON.stringify(data.errors)) return;
  await db().from(T).update({ errors }).eq("id", id);
}

export { pagePath };
