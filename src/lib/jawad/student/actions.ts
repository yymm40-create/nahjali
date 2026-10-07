// «الطالب الذكي» — what the student can do, checked on the server: sources, review, approvals, scope, outputs.
// Paid steps answer `{ quote: coins }` first (nothing runs) and run only when sent again with `confirm: true` and a key.

import { UserError } from "@/lib/api";
import { coinBalance, coinsRequired } from "@/lib/coins";
import { sniff } from "@/lib/jawad/media";
import { coinsFor } from "@config/coins";
import { isUnlimited } from "@config/site";
import { FONTS, OUTPUT_KINDS, PURPOSES, SOURCE_MODES, STUDENT, STYLES, STYLE_ROLES, readBrief, type Brief, type Design } from "@config/jawad/student";
import { claudeCeilingUsd } from "./claude";
import { loadCtx } from "./context";
import { addVersion, getFile, getOutput, getProject, latestVersion, outputs, saveOutput, sdb, segments, sources, touch, type Output, type Project, type TextVersion } from "./db";
import { coverage, extractCeiling, pdfPageCount } from "./extract";
import { checkKey, createJob, jobView, projectJobs, advanceJobs } from "./jobs";
import type { AudioPlan, Doc, DocPlan, QuizPlan, SlidePlan } from "./model";
import { estimate } from "./outputs";
import { PICTURE_KINDS, pageUsd, picturesPlan } from "./pictures";
import { slideImageUsd } from "./slide-images";
import { researchCeiling } from "./research";
import { understandCeiling, type Understanding } from "./understand";
import { autoSettings } from "./defaults";
import { pickDesigns } from "./design-pick";

import { storage } from "@/lib/storage";
type User = { id: string; email?: string | null };
type Body = Record<string, unknown>;

const text = (v: unknown, max: number) => String(v ?? "").slice(0, max).trim();
const NOT_NOW = "هذه الخطوة غير متاحة الآن.";

// ───────────────────────────── state ─────────────────────────────

/**
 * What one page / slide drawn by GPT Image 2 costs this person, in coins (0 when nothing is charged), for the choice
 * «GPT Image 2 or Claude» (Claude's pages cost nothing on top of the writing).
 */
async function drawPrices(user: User) {
  const free = isUnlimited(user.email) || !(await coinsRequired());
  const c = (usd: number) => (free ? 0 : coinsFor(usd));
  return { free, page: { high: c(pageUsd("high")), medium: c(pageUsd("medium")) }, slide: { high: c(slideImageUsd("high")), medium: c(slideImageUsd("medium")) } };
}

export async function projectState(user: User, id: string) {
  const p = await getProject(user.id, id);
  await advanceJobs({ projectId: p.id });
  const [srcs, segs, cov, textV, und, research, outs, jobs, balance, prices] = await Promise.all([
    sources(p.id),
    segments(p.id),
    coverage(p.id),
    latestVersion<TextVersion>(p.id, "text", true),
    latestVersion<Understanding>(p.id, "understanding"),
    latestVersion(p.id, "research"),
    outputs(p.id),
    projectJobs(p.id),
    coinBalance(user.id),
    drawPrices(user),
  ]);
  return {
    prices,
    project: { ...p, brief: readBrief(p.brief), expiresAt: new Date(new Date(p.last_activity_at).getTime() + STUDENT.keepDays * 86400_000).toISOString() },
    sources: srcs.map((s) => ({ id: s.id, ord: s.ord, kind: s.kind, name: s.name, mime: s.mime, bytes: s.bytes, pages: s.pages, pagesDone: s.pages_done, status: s.status, body: s.kind === "text" ? s.body : null })),
    segments: segs.map((s) => ({ id: s.id, sid: s.id.slice(0, 8), sourceId: s.source_id, page: s.page, part: s.part, label: s.label, raw: s.raw_text, text: s.text, uncertain: s.uncertain, status: s.status })),
    coverage: cov,
    textVersion: textV ? { version: textV.version, at: textV.created_at } : null,
    understanding: und ? { version: und.version, approved: und.version === p.understanding_version, content: { ...und.content, notes: [] }, note: und.note } : null,
    research: research ? { version: research.version, approved: research.version === p.research_version, content: research.content } : null,
    outputs: outs.map(outputView),
    jobs: jobs.map(jobView),
    balance,
  };
}

export const outputView = (o: Output) => ({
  id: o.id,
  kind: o.kind,
  ord: o.ord,
  title: o.title,
  settings: o.settings,
  status: o.status,
  stale: o.stale,
  dependsOn: o.depends_on,
  plan: o.plan,
  planApproved: o.plan_approved,
  trial: o.trial,
  trialCoins: o.trial_coins,
  content: o.content,
  files: Object.keys(o.files),
  approved: o.approved,
  requests: o.requests,
  error: o.error,
  updatedAt: o.updated_at,
});

export async function listProjects(userId: string) {
  const { data } = await sdb().from("student_projects").select("id,title,level,stage,last_activity_at,created_at").eq("user_id", userId).order("last_activity_at", { ascending: false }).limit(100);
  return ((data ?? []) as { id: string; title: string; level: string; stage: string; last_activity_at: string; created_at: string }[]).map((p) => ({
    ...p,
    expiresAt: new Date(new Date(p.last_activity_at).getTime() + STUDENT.keepDays * 86400_000).toISOString(),
  }));
}

/** The first page's answers, checked. */
function cleanBrief(v: unknown): Brief {
  const b = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return readBrief({
    purpose: PURPOSES.some((x) => x.id === b.purpose) ? b.purpose : "exam",
    purposeNote: text(b.purposeNote, 1000),
    mode: SOURCE_MODES.some((x) => x.id === b.mode) ? b.mode : "files",
    focus: text(b.focus, 2000),
  });
}

/** Materials each person may make in «الطالب الذكي» (the owner's choice); the owner and free guests have no limit. */
export const MATERIALS_PER_PERSON = 2;
/** How many materials this person has made so far (kept on the account, so deleting one does not give it back). */
export const materialsMade = (user: { app_metadata?: Record<string, unknown> }) => Number(user.app_metadata?.student_made ?? 0) || 0;

export async function createProject(user: User & { app_metadata?: Record<string, unknown> }, b: Body) {
  const made = materialsMade(user);
  const limited = !isUnlimited(user.email);
  if (limited && made >= MATERIALS_PER_PERSON) throw new UserError(`لكل حساب ${MATERIALS_PER_PERSON} مادتان فقط في «الطالب الذكي»، واستخدمتهما.`, 403);
  const row = { user_id: user.id, title: text(b.title, 200) || "مادة جديدة", level: text(b.level, 120), audience: text(b.audience, 300) };
  const brief = cleanBrief(b.brief);
  let { data, error } = await sdb().from("student_projects").insert({ ...row, brief }).select("id").single();
  // before SQL 0035 (no «brief» column) the material is made without it
  if (error?.code === "42703" || error?.code === "PGRST204") ({ data, error } = await sdb().from("student_projects").insert(row).select("id").single());
  if (error || !data) throw error?.code === "42P01" ? new UserError("قسم «الطالب الذكي» قيد التجهيز: شغّل ملف SQL رقم 0026.", 503) : (error ?? new Error("no project"));
  if (limited) await sdb().auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata ?? {}), student_made: made + 1 } });
  return data.id as string;
}

// ───────────────────────────── paid steps ─────────────────────────────

/** Quote first (nothing runs), then run with the same key once the student confirmed. */
async function paid(user: User, b: Body, o: { projectId: string; outputId?: string; kind: string; usd: number; input?: Record<string, unknown>; stage?: string; started?: () => Promise<void> }) {
  // nothing is charged (the owner, a free guest, or while coins are switched off): no price to agree to
  const free = isUnlimited(user.email) || !(await coinsRequired());
  const coins = o.usd > 0 && !free ? coinsFor(o.usd) : 0;
  if (!b.confirm) return { quote: coins, balance: await coinBalance(user.id) };
  const key = checkKey(b.key);
  const { job, created } = await createJob(user, { projectId: o.projectId, outputId: o.outputId ?? null, kind: o.kind, key, input: o.input, estimateUsd: o.usd, stage: o.stage });
  // the job itself runs after this response, so the status set here comes before anything it writes
  if (created) await o.started?.();
  return { job: jobView(job) };
}

/** Outputs built on an older approved text / understanding / research are marked: they need re-approval before use. */
async function markStale(p: Project) {
  for (const o of await outputs(p.id)) {
    if (!o.plan && !o.content) continue;
    const b = o.based_on;
    const old = (b.text !== undefined && b.text !== p.text_version) || (b.understanding !== undefined && b.understanding !== p.understanding_version) || (b.research !== undefined && b.research !== p.research_version);
    if (old && !o.stale) await saveOutput(o.id, { stale: true });
  }
}

// ───────────────────────────── project actions ─────────────────────────────

export async function projectAction(user: User, id: string, b: Body) {
  const p = await getProject(user.id, id);
  const db = sdb();
  switch (b.action) {
    case "meta": {
      await touch(p.id, { title: text(b.title, 200) || p.title, level: text(b.level, 120), audience: text(b.audience, 300) } as Partial<Project>);
      return { ok: true };
    }
    case "source_text": {
      const body = String(b.body ?? "").replace(/\r\n?/g, "\n");
      if (!body.trim()) throw new UserError("اكتب النص أولًا.");
      const ord = (await sources(p.id)).length;
      await db.from("student_sources").insert({ project_id: p.id, user_id: user.id, ord, kind: "text", name: text(b.name, 300) || "نص مكتوب", body, mime: "text/plain", bytes: Buffer.byteLength(body), pages: 1, status: "ready" });
      await touch(p.id, { stage: p.stage === "sources" ? "sources" : "review" });
      return { ok: true };
    }
    case "source_file": {
      const mime = String(b.mime ?? "");
      const kind = mime === "application/pdf" ? "pdf" : /^image\/(png|jpeg|webp)$/.test(mime) ? "image" : null;
      if (!kind) throw new UserError("الملفات المقبولة: PDF أو صور PNG / JPG / WEBP.");
      const ord = (await sources(p.id)).length;
      const ext = kind === "pdf" ? "pdf" : mime.split("/")[1].replace("jpeg", "jpg");
      const { data, error } = await db
        .from("student_sources")
        .insert({ project_id: p.id, user_id: user.id, ord, kind, name: text(b.name, 300), mime, bytes: Number(b.bytes) || 0, status: "pending" })
        .select("id")
        .single();
      if (error) throw error;
      const path = `${user.id}/${p.id}/src/${data.id}.${ext}`;
      await db.from("student_sources").update({ path }).eq("id", data.id);
      const { data: up, error: e2 } = await storage.from(STUDENT.bucket).createSignedUploadUrl(path);
      if (e2) throw e2;
      return { sourceId: data.id, signedUrl: up.signedUrl };
    }
    case "source_confirm": {
      const s = (await sources(p.id)).find((x) => x.id === b.sourceId);
      if (!s || !s.path) throw new UserError("ما لقينا هذا الملف.", 404);
      let buf: Buffer;
      try {
        buf = await getFile(s.path);
      } catch {
        throw new UserError("ما وصل الملف. جرّب رفعه مرة ثانية.");
      }
      // what the file really is, from its bytes
      let pages = 1;
      if (s.kind === "pdf") {
        if (buf.subarray(0, 1024).toString("latin1").indexOf("%PDF-") < 0) return reject(s.id, "هذا الملف ليس PDF صالحًا.");
        try {
          pages = await pdfPageCount(buf);
        } catch {
          return reject(s.id, "تعذّر فتح ملف PDF (قد يكون محميًا بكلمة مرور أو تالفًا).");
        }
        if (!pages) return reject(s.id, "ملف PDF بلا صفحات.");
      } else {
        const t = sniff(new Uint8Array(buf.subarray(0, 32)));
        if (t?.kind !== "image") return reject(s.id, "هذا الملف ليس صورة PNG أو JPG أو WEBP.");
      }
      await db.from("student_sources").update({ status: "ready", pages, bytes: buf.length }).eq("id", s.id);
      await touch(p.id);
      return { ok: true, pages };
    }
    case "source_remove": {
      const s = (await sources(p.id)).find((x) => x.id === b.sourceId);
      if (!s) throw new UserError("ما لقينا هذا المدخل.", 404);
      if (s.path) await storage.from(STUDENT.bucket).remove([s.path]);
      await db.from("student_sources").delete().eq("id", s.id);
      // the full text changed: it must be approved again
      await touch(p.id, { stage: p.text_version ? "review" : p.stage });
      return { ok: true };
    }
    case "source_order": {
      const ids = (b.ids as string[]) ?? [];
      const list = await sources(p.id);
      for (const [i, sid] of ids.entries()) if (list.some((s) => s.id === sid)) await db.from("student_sources").update({ ord: i }).eq("id", sid);
      if (p.text_version) await touch(p.id, { stage: "review" });
      return { ok: true };
    }
    case "extract": {
      const list = await sources(p.id);
      if (list.some((s) => s.status === "pending")) throw new UserError("فيه ملف ما اكتمل رفعه. انتظره أو احذفه.");
      if (!list.some((s) => s.status === "ready")) throw new UserError("أضف نصًا أو ملفًا أولًا.");
      const c = extractCeiling(list);
      return paid(user, b, { projectId: p.id, kind: "extract", usd: c.usd, stage: "استخراج النص" });
    }
    case "segment_save": {
      const t = String(b.text ?? "");
      const { data } = await db.from("student_segments").update({ text: t, status: "pending", updated_at: new Date().toISOString() }).eq("id", b.segmentId).eq("project_id", p.id).select("id");
      if (!data?.length) throw new UserError("ما لقينا هذا الجزء.", 404);
      await touch(p.id, { stage: "review" });
      return { ok: true };
    }
    case "segments_approve_all": {
      // every part still waiting, as it stands now (the student's corrections included)
      const { error } = await db.from("student_segments").update({ status: "approved", updated_at: new Date().toISOString() }).eq("project_id", p.id).eq("status", "pending");
      if (error) throw error;
      await touch(p.id, { stage: "review" });
      return { ok: true };
    }
    case "segment_approve":
    case "segment_reopen": {
      const status = b.action === "segment_approve" ? "approved" : "pending";
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (typeof b.text === "string") patch.text = b.text;
      const { data } = await db.from("student_segments").update(patch).eq("id", b.segmentId).eq("project_id", p.id).select("id");
      if (!data?.length) throw new UserError("ما لقينا هذا الجزء.", 404);
      await touch(p.id, { stage: "review" });
      return { ok: true };
    }
    case "text_approve": {
      const cov = await coverage(p.id);
      if (cov.missing.length) throw new UserError(`ناقص: ${cov.missing.slice(0, 5).join("، ")}${cov.missing.length > 5 ? "…" : ""}. شغّل الاستخراج لإكمالها.`);
      if (cov.duplicate.length) throw new UserError(`مكرر: ${cov.duplicate.join("، ")}.`);
      if (!cov.complete) throw new UserError(`اعتمد كل الأجزاء أولًا (${cov.approved} من ${cov.total}).`);
      const segs = await segments(p.id);
      const v = await addVersion<TextVersion>(p, "text", { segments: segs.map((s) => ({ id: s.id, label: s.label, text: s.text })) });
      await db.from("student_versions").update({ approved: true }).eq("id", v.id);
      const next = { ...p, text_version: v.version, understanding_version: 0, stage: "understanding" as const };
      await touch(p.id, { text_version: v.version, understanding_version: 0, stage: "understanding" });
      await markStale(next);
      return { ok: true, version: v.version };
    }
    case "understand": {
      if (!p.text_version) throw new UserError("اعتمد النص الكامل أولًا.");
      const t = await latestVersion<TextVersion>(p.id, "text", true);
      const note = text(b.note, 3000);
      const revising = Boolean(note) && Boolean(await latestVersion(p.id, "understanding"));
      // a revision only combines the notes again (the text is not re-read)
      const usd = revising ? claudeCeilingUsd(t!.content.segments.length * 400, 14000) : understandCeiling(t!.content);
      return paid(user, b, { projectId: p.id, kind: "understand", usd, input: { textVersion: p.text_version, note, previous: revising, requestKind: b.kind === "other" ? "other" : "edit" }, stage: "فهم المادة" });
    }
    case "understanding_approve": {
      const u = await latestVersion<Understanding>(p.id, "understanding");
      if (!u || u.content.basedOnText !== p.text_version) throw new UserError(NOT_NOW);
      await db.from("student_versions").update({ approved: true }).eq("id", u.id);
      // The source rules are set once, from the first page: explanations allowed (and marked as additions), and the
      // web research only for «ملفاتي + بحث», which then runs next (stage «scope», done by the assistant). A revised
      // understanding keeps the rules it had.
      const firstTime = p.allow_additions === null;
      const research = firstTime ? readBrief(p.brief).mode === "both" : Boolean(p.web_search);
      const stage = research && !p.research_version ? ("scope" as const) : ("outputs" as const);
      const next = { ...p, understanding_version: u.version, stage, ...(firstTime ? { allow_additions: true, web_search: research } : {}) };
      await touch(p.id, { understanding_version: u.version, stage, ...(firstTime ? { allow_additions: true, web_search: research } : {}) });
      await markStale(next);
      return { ok: true };
    }
    case "scope": {
      if (!p.understanding_version) throw new UserError("اعتمد الفهم أولًا.");
      if (typeof b.allowAdditions !== "boolean" || typeof b.webSearch !== "boolean") throw new UserError("أجب عن السؤالين.");
      const research = b.webSearch ? p.research_version : 0;
      const next = { ...p, allow_additions: b.allowAdditions, web_search: b.webSearch, research_version: research };
      await touch(p.id, { allow_additions: b.allowAdditions, web_search: b.webSearch, research_version: research, stage: b.webSearch && !research ? "scope" : "outputs" });
      if (p.allow_additions !== null && (p.allow_additions !== b.allowAdditions || p.web_search !== b.webSearch)) {
        // a changed rule changes what every written output may contain
        for (const o of await outputs(p.id)) if (o.plan || o.content) await saveOutput(o.id, { stale: true });
      }
      await markStale(next);
      return { ok: true };
    }
    case "research": {
      if (!p.web_search || !p.understanding_version) throw new UserError(NOT_NOW);
      return paid(user, b, { projectId: p.id, kind: "research", usd: researchCeiling(), input: { focus: text(b.focus, 2000) }, stage: "البحث في الويب" });
    }
    case "research_material": {
      // «كلاود يبحث لي»: the research becomes the material (a written source), before anything is read
      return paid(user, b, { projectId: p.id, kind: "research", usd: researchCeiling(), input: { asMaterial: true, focus: text(b.focus, 2000) }, stage: "كلاود يبحث ويكتب مادتك" });
    }
    case "research_approve": {
      const r = await latestVersion(p.id, "research");
      if (!r || !p.web_search) throw new UserError(NOT_NOW);
      await db.from("student_versions").update({ approved: true }).eq("id", r.id);
      await touch(p.id, { research_version: r.version, stage: "outputs" });
      await markStale({ ...p, research_version: r.version });
      return { ok: true };
    }
    case "outputs_add": {
      if (p.stage !== "outputs") throw new UserError("أكمل اعتماد الفهم وحدود المصدر أولًا.");
      const kinds = ((b.kinds as string[]) ?? []).filter((k) => OUTPUT_KINDS.some((o) => o.kind === k));
      if (!kinds.length) throw new UserError("اختر ناتجًا واحدًا على الأقل.");
      const existing = await outputs(p.id);
      const rows = kinds.map((k, i) => ({
        project_id: p.id,
        user_id: user.id,
        kind: k,
        ord: existing.length + i,
        title: OUTPUT_KINDS.find((o) => o.kind === k)!.name,
        status: "settings",
        // pre-filled with the assistant's choices for this level: «اعرض الخطة» is one press away
        settings: autoSettings(k, p.level),
      }));
      await db.from("student_outputs").insert(rows);
      await touch(p.id);
      return { ok: true };
    }
    case "start": {
      // The one «ابدأ» of the outputs page: every chosen output with the student's answers, the design picked by
      // Claude (never asked), and the special request passed to each. The page then runs them all (autopilot).
      if (p.stage !== "outputs") throw new UserError("اعتمد الفهم أولًا.");
      const wanted = (Array.isArray(b.outputs) ? b.outputs : []).slice(0, OUTPUT_KINDS.length) as { kind?: unknown; settings?: unknown }[];
      const list = wanted.filter((w, i) => OUTPUT_KINDS.some((o) => o.kind === w.kind) && wanted.findIndex((x) => x.kind === w.kind) === i);
      if (!list.length) throw new UserError("اختر ناتجًا واحدًا على الأقل.");
      const special = text(b.special, 3000);
      const kinds = list.map((w) => String(w.kind));
      const u = await latestVersion<Understanding>(p.id, "understanding");
      const { designs, notes } = await pickDesigns(p, kinds, u?.content.topic ?? p.title, special);
      const existing = await outputs(p.id);
      const rows = list.map((w, i) => {
        const kind = String(w.kind) as Output["kind"];
        const given = (w.settings && typeof w.settings === "object" ? w.settings : {}) as Body;
        const extra = [text(given.extra, 2000), notes[kind] ?? ""].filter(Boolean).join("\n");
        const settings = cleanSettings(kind, { ...autoSettings(kind, p.level), ...given, ...(designs[kind] ? { design: designs[kind] } : {}), ...(extra ? { extra } : {}) });
        if (kind === "audio") settings.source = "text";
        return { project_id: p.id, user_id: user.id, kind, ord: existing.length + i, title: OUTPUT_KINDS.find((o) => o.kind === kind)!.name, status: "settings", settings };
      });
      const { data: made, error } = await db.from("student_outputs").insert(rows).select("id,kind");
      if (error) throw error;
      // a recording of the summary / explanation / book made here: it waits for that text
      const audio = list.find((w) => w.kind === "audio");
      const reads = String((audio?.settings as Body | undefined)?.source ?? "");
      const dep = (made ?? []).find((m) => m.kind === reads && ["summary", "explain", "book"].includes(reads));
      const rec = (made ?? []).find((m) => m.kind === "audio");
      if (dep && rec) {
        const r = rows.find((x) => x.kind === "audio")!;
        await saveOutput(rec.id as string, { settings: { ...r.settings, source: dep.id }, depends_on: dep.id as string, status: "waiting" });
      }
      await touch(p.id);
      return { ok: true };
    }
    case "outputs_order": {
      const ids = (b.ids as string[]) ?? [];
      const list = await outputs(p.id);
      for (const [i, oid] of ids.entries()) if (list.some((o) => o.id === oid)) await db.from("student_outputs").update({ ord: i }).eq("id", oid);
      return { ok: true };
    }
    case "output_remove": {
      const o = await getOutput(user.id, String(b.outputId));
      if (o.project_id !== p.id) throw new UserError("ما لقينا هذا الناتج.", 404);
      await db.from("student_outputs").delete().eq("id", o.id);
      return { ok: true };
    }
    case "delete": {
      const { removeFolder } = await import("./db");
      await removeFolder(`${user.id}/${p.id}`);
      await db.from("student_projects").delete().eq("id", p.id);
      return { ok: true };
    }
  }
  throw new UserError("طلب غير معروف.");
}

async function reject(id: string, message: string): Promise<never> {
  await sdb().from("student_sources").update({ status: "rejected" }).eq("id", id);
  throw new UserError(message);
}

// ───────────────────────────── output actions ─────────────────────────────

function cleanDesign(v: unknown): Design | undefined {
  if (!v || typeof v !== "object") return undefined;
  const d = v as Design;
  const styleIds = STYLES.map((s) => s.id) as string[];
  const fontIds = FONTS.map((f) => f.id);
  if (!styleIds.includes(d.main)) return undefined;
  const roles: Design["roles"] = {};
  for (const r of STYLE_ROLES) {
    const s = d.roles?.[r.id];
    if (s && styleIds.includes(s)) roles[r.id] = s;
  }
  const font = (x: unknown, dflt: string) => (fontIds.includes(String(x)) ? String(x) : dflt);
  const hexOk = (x: unknown) => typeof x === "string" && /^#[0-9a-fA-F]{6}$/.test(x);
  const custom =
    d.custom && typeof d.custom === "object" && d.custom.colors && Object.values(d.custom.colors).every(hexOk)
      ? { description: text(d.custom.description, 3000), colors: d.custom.colors, texture: (["none", "paper", "lines", "grid"].includes(d.custom.texture) ? d.custom.texture : "none") as "none", radius: Math.max(0, Math.min(24, Number(d.custom.radius) || 0)), notes: text(d.custom.notes, 3000) }
      : null;
  return { main: d.main, roles, fonts: { heading: font(d.fonts?.heading, "readex"), body: font(d.fonts?.body, "plex"), accent: font(d.fonts?.accent, "amiri") }, custom };
}

function cleanSettings(kind: Output["kind"], s: Body) {
  const out: Body = {};
  for (const [k, v] of Object.entries(s)) {
    if (k.startsWith("_") || k === "design") continue;
    if (typeof v === "string") out[k] = v.slice(0, 4000);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(0, Math.min(500, v));
    else if (typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === "string").slice(0, 10);
  }
  if (kind === "book" || kind === "slides" || kind === "summary" || kind === "explain" || kind === "quiz") {
    const d = cleanDesign(s.design);
    if (d) out.design = d;
  }
  if (kind === "audio" && typeof s.customText === "string") out.customText = s.customText.slice(0, 200_000);
  return out;
}

/** A plan the student edited by hand: same shape, sizes bounded. */
function cleanPlan(o: Output, plan: unknown): unknown {
  if (!plan || typeof plan !== "object") throw new UserError("الخطة غير صالحة.");
  const s = (v: unknown, n = 4000) => String(v ?? "").slice(0, n);
  const arr = <T>(v: unknown, f: (x: Record<string, unknown>) => T, n = 300) => (Array.isArray(v) ? v.slice(0, n).map((x) => f((x ?? {}) as Record<string, unknown>)) : []);
  // a file path from the browser is kept only if it is one of this project's own files
  const own = (v: unknown) => {
    const path = s(v, 400);
    return path.startsWith(`${o.user_id}/${o.project_id}/`) && !path.includes("..") ? path : "";
  };
  const img = (x: unknown) => {
    const i = (x ?? {}) as Record<string, unknown>;
    const mode = ["none", "own", "generate"].includes(String(i.mode)) ? String(i.mode) : "none";
    return { mode: mode as "none", sourceId: s(i.sourceId, 40), prompt: s(i.prompt, 1000), path: mode === "none" ? "" : own(i.path) };
  };
  const rendered = (x: unknown) => {
    const r = (x ?? null) as Record<string, unknown> | null;
    const path = r ? own(r.path) : "";
    return path ? { path, sig: s(r!.sig, 32) } : null;
  };
  const p = plan as Record<string, unknown>;
  const prev = (o.plan ?? {}) as Record<string, unknown>;
  if (o.kind === "slides") {
    const layouts = ["title", "bullets", "cards", "quote", "compare", "image", "section"];
    return {
      title: s(p.title, 300),
      subtitle: s(p.subtitle, 300),
      slides: arr(p.slides, (x) => ({
        title: s(x.title, 300),
        idea: s(x.idea, 1000),
        layout: (layouts.includes(String(x.layout)) ? String(x.layout) : "bullets") as SlidePlan["slides"][number]["layout"],
        text: Array.isArray(x.text) ? x.text.slice(0, 20).map((t) => s(t, 600)) : [],
        visual: s(x.visual, 600),
        notes: s(x.notes, 4000),
        relation: s(x.relation, 600),
        segments: Array.isArray(x.segments) ? x.segments.slice(0, 200).map((t) => s(t, 8)) : [],
        image: img(x.image),
        rendered: rendered(x.rendered),
      })),
    } satisfies SlidePlan;
  }
  if (o.kind === "quiz") {
    return { rows: arr(p.rows, (x) => ({ topic: s(x.topic, 300), segments: Array.isArray(x.segments) ? x.segments.slice(0, 200).map((t) => s(t, 8)) : [], counts: Object.fromEntries(["mcq", "tf", "short", "essay", "long", "custom"].map((k) => [k, Math.max(0, Math.min(100, Number((x.counts as Record<string, unknown>)?.[k]) || 0))])) })) } satisfies QuizPlan;
  }
  if (o.kind === "audio") {
    const before = (prev as unknown as AudioPlan).files ?? [];
    return { files: arr(p.files, (x) => ({ title: s(x.title, 300), original: before.find((f) => f.title === x.title)?.original ?? s(x.original, 400_000), text: s(x.text, 400_000) })) } satisfies AudioPlan;
  }
  return {
    title: s(p.title, 300),
    subtitle: s(p.subtitle, 300),
    chapters: arr(p.chapters, (x) => ({ title: s(x.title, 300), purpose: s(x.purpose, 2000), segments: Array.isArray(x.segments) ? x.segments.slice(0, 2000).map((t) => s(t, 8)) : [], image: img(x.image) })),
  } satisfies DocPlan;
}

export async function outputAction(user: User, id: string, b: Body) {
  const o = await getOutput(user.id, id);
  const p = await getProject(user.id, o.project_id);
  if (p.stage !== "outputs") throw new UserError("أكمل اعتماد المراحل السابقة أولًا.");
  await touch(p.id);
  // `extra` (the student's request, approval taken back) is saved only once the job really started: a refused job
  // (busy, short balance) leaves the output exactly as it was
  const run = (kind: string, usd: number, input: Record<string, unknown> = {}, stage?: string, status?: string, extra: Record<string, unknown> = {}) =>
    paid(user, b, { projectId: p.id, outputId: o.id, kind, usd, input, stage, started: status ? () => saveOutput(o.id, { ...extra, status, error: null }) : undefined });

  switch (b.action) {
    case "settings": {
      const settings = cleanSettings(o.kind, (b.settings ?? {}) as Body);
      if (o.kind === "audio") {
        const src = String(settings.source ?? "text");
        if (src !== "text" && src !== "custom") {
          const dep = (await outputs(p.id)).find((x) => x.id === src && (x.kind === "summary" || x.kind === "explain" || x.kind === "book"));
          if (!dep) throw new UserError("اختر نصًا من نواتج هذه المادة.");
          await saveOutput(o.id, { settings: { ...settings, _styleDraft: undefined }, depends_on: dep.id, status: dep.status === "done" ? "settings" : "waiting", plan_approved: false });
          return { ok: true };
        }
      }
      await saveOutput(o.id, { settings: { ...o.settings, ...settings, _styleDraft: o.settings._styleDraft }, depends_on: null, status: "settings", plan_approved: false, error: null });
      return { ok: true };
    }
    case "plan": {
      if (o.kind === "transcript") throw new UserError(NOT_NOW);
      if (o.status === "waiting") throw new UserError("هذا الصوت يقرأ ناتجًا لم يُعتمد بعد: اعتمد ذلك الناتج أولًا.");
      const note = text(b.note, 4000);
      const requests = note ? [...o.requests, { at: new Date().toISOString(), kind: (b.kind === "other" ? "other" : "edit") as "edit", text: note }] : o.requests;
      return run("plan", await estimate(user.id, o, "plan"), { note, previous: Boolean(note && o.plan) }, o.kind === "audio" ? "تجهيز نص القراءة" : "إعداد الخطة", "planning", note ? { requests } : {});
    }
    case "plan_save": {
      if (!o.plan) throw new UserError(NOT_NOW);
      const plan = cleanPlan(o, b.plan);
      // written chapters / questions were made from the old plan: they are made again from the edited one
      await saveOutput(o.id, { plan, plan_approved: false, status: "plan_review", ...(o.kind === "audio" ? {} : { content: null }) }, { kind: "plan_edit", snapshot: plan, userId: user.id });
      return { ok: true };
    }
    case "plan_approve": {
      if (!o.plan || o.status !== "plan_review") throw new UserError(NOT_NOW);
      await saveOutput(o.id, { plan_approved: true, stale: false, status: o.kind === "book" || o.kind === "slides" ? "trial_offer" : "ready" });
      return { ok: true };
    }
    case "trial": {
      if (!o.plan_approved || !["trial_offer", "trial_review"].includes(o.status)) throw new UserError(NOT_NOW);
      return run("trial", await estimate(user.id, o, "trial"), {}, "النسخة التجريبية", "trial_running");
    }
    case "skip_trial": {
      if (!o.plan_approved) throw new UserError(NOT_NOW);
      await saveOutput(o.id, { status: "ready" });
      return { ok: true };
    }
    case "final": {
      if (o.kind === "transcript") {
        const c = await loadCtx(user.id, p.id);
        const segs = await segments(p.id);
        const content = { title: p.title || c.understanding.topic, segments: c.text.segments.map((s) => ({ label: s.label, raw: segs.find((x) => x.id === s.id)?.raw_text ?? s.text, text: s.text })) };
        await saveOutput(o.id, { content, based_on: { text: p.text_version } });
        return run("final", 0, {}, "إنشاء التفريغ", "running");
      }
      if (!o.plan_approved || !["ready", "trial_offer", "trial_review", "review", "done", "failed"].includes(o.status)) throw new UserError(NOT_NOW);
      const prevRun = Number((o.content as { run?: number } | null)?.run ?? 0);
      // what the trial made is kept and not charged again (so the trial's coins are not given back as well)
      const reusedTrial =
        (["summary", "explain", "book"].includes(o.kind) && ((o.content as Doc | null)?.chapters?.length ?? 0) > 0) ||
        (o.kind === "slides" && Boolean((o.plan as SlidePlan | null)?.slides?.some((x) => x.rendered?.path)));
      return run("final", await estimate(user.id, o, "final"), o.kind === "audio" ? { run: prevRun + 1 } : { reusedTrial }, "إنشاء الناتج", "running");
    }
    case "audio_retry": {
      const c = o.content as { run?: number; failedParts?: number } | null;
      if (o.kind !== "audio" || !c?.run || !c.failedParts) throw new UserError(NOT_NOW);
      const { data } = await sdb().from("student_audio_parts").select("text").eq("output_id", o.id).eq("run", c.run).eq("status", "failed");
      const chars = ((data ?? []) as { text: string }[]).reduce((s, r) => s + r.text.length, 0);
      return run("final", (chars / 1000) * 0.08 * 1.02, { run: c.run, retry: true }, "إعادة المقاطع المتعثرة", "running");
    }
    case "request": {
      // «عدّل» or «أمر آخر» on a finished output
      const note = text(b.note, 4000);
      if (!note) throw new UserError("اكتب ما تريد.");
      const kind = b.kind === "other" ? "other" : "edit";
      if (!["review", "done"].includes(o.status)) throw new UserError(NOT_NOW);
      const requests = [...o.requests, { at: new Date().toISOString(), kind: kind as "edit", text: note }];
      if (o.kind === "summary" || o.kind === "explain" || o.kind === "book" || o.kind === "quiz") {
        const chapter = Number.isInteger(b.chapter) ? Number(b.chapter) : -1;
        return run("revise", await estimate(user.id, o, o.kind === "quiz" ? "final" : "revise", chapter), { note, chapter, requestKind: kind }, "تعديل الناتج", "running", { requests, approved: false });
      }
      // slides made as pictures: one slide is drawn again with the request
      if (o.kind === "slides" && o.settings.render === "image" && Number.isInteger(b.chapter) && Number(b.chapter) >= 0) {
        return run("revise", await estimate(user.id, o, "revise"), { note, chapter: Number(b.chapter), requestKind: kind }, "رسم الشريحة من جديد", "running", { requests, approved: false });
      }
      // slides / audio: the change goes into the plan (slide map / reading text), which is approved again
      return run("plan", await estimate(user.id, o, "plan"), { note, previous: true }, "تعديل الخطة", "planning", { requests, approved: false });
    }
    case "approve": {
      if (o.status !== "review") throw new UserError(NOT_NOW);
      await saveOutput(o.id, { status: "done", approved: true, stale: false });
      // outputs that read this one (audio of a summary) can start now, or must be re-approved if they were built before
      for (const d of (await outputs(p.id)).filter((x) => x.depends_on === o.id)) {
        if (d.status === "waiting") await saveOutput(d.id, { status: "settings" });
        else if (d.plan) await saveOutput(d.id, { stale: true });
      }
      return { ok: true };
    }
    case "reopen": {
      await saveOutput(o.id, { status: o.content || o.files ? "review" : "settings", approved: false });
      return { ok: true };
    }
    case "style_analyze": {
      const description = text(b.description, 3000);
      if (description.length < 10) throw new UserError("صف أسلوبك بجملة أو أكثر.");
      return run("style", 0.05, { description }, "فهم الأسلوب الخاص");
    }
    case "style_accept": {
      const draft = cleanDesign(o.settings._styleDraft);
      if (!draft) throw new UserError(NOT_NOW);
      await saveOutput(o.id, { settings: { ...o.settings, design: draft, _styleDraft: null } });
      return { ok: true };
    }
    case "pictures": {
      // the finished output drawn as designed pages with GPT Image 2 (or one page drawn again with a note)
      if (!PICTURE_KINDS.includes(o.kind) || !["review", "done"].includes(o.status) || !o.content) throw new UserError(NOT_NOW);
      const quality = b.quality === "medium" ? "medium" : "high";
      const page = Number.isInteger(b.page) ? Number(b.page) : -1;
      const note = text(b.note, 2000);
      const usd = page >= 0 ? pageUsd(quality) : picturesPlan(o, quality).usd;
      return run("pictures", usd, { quality, page, note }, "صفحات مصممة بـ GPT Image 2");
    }
    case "quiz_attempt": {
      const c = o.content as { questions: { type: string; answer: string }[] } | null;
      if (o.kind !== "quiz" || !c) throw new UserError(NOT_NOW);
      const answers = (b.answers ?? {}) as Record<string, string>;
      const auto = c.questions.map((q, i) => ({ q, i })).filter(({ q }) => q.type === "mcq" || q.type === "tf");
      const right = auto.filter(({ q, i }) => String(answers[i] ?? "").trim() === q.answer.trim()).length;
      const score = auto.length ? Math.round((right / auto.length) * 100) : null;
      await sdb().from("student_quiz_attempts").insert({ output_id: o.id, user_id: user.id, answers, score });
      return { score, right, total: auto.length };
    }
  }
  throw new UserError("طلب غير معروف.");
}

export async function outputFile(userId: string, id: string, name: string) {
  const o = await getOutput(userId, id);
  const path = o.files[name];
  if (!path) throw new UserError("الملف غير موجود.", 404);
  const ext = path.split(".").pop();
  const { signFile } = await import("./db");
  return signFile(path, 600, `${(o.title || "ملف").replace(/[\\/:*?"<>|]/g, "")}-${name}.${ext}`);
}

export async function sourceFile(userId: string, projectId: string, sourceId: string) {
  const p = await getProject(userId, projectId);
  const s = (await sources(p.id)).find((x) => x.id === sourceId);
  if (!s?.path) throw new UserError("الملف غير موجود.", 404);
  const { signFile } = await import("./db");
  return signFile(s.path, 600);
}
