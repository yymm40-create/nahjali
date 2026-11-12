// «سجل التغييرات» · «ارجع لهنا» · «تعليماتي الدايمة» in «حيدرة كت». Server only. The log is read from editor_ops (0030);
// the points to come back to and the standing instructions need migration 0111 — until it runs the log still shows,
// nothing is kept to go back to (the page hides «ارجع لهنا»), and the instructions live in the person's browser (the
// page sends its copy with every request). Nothing here ever fails a save.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { changeLog, cleanRules, INTERNAL_ACTORS, readSteps, shouldSnapshot, SNAPSHOT_CAP, toPrune, whoDid, type OpRow, type PageActor } from "./changes-core";
import { readTimeline, type Timeline } from "./model";

const db = () => createAdminClient();
/** How many saves the log reads (a turn of حيدرا ماكس is a few of them). */
const LOG_ROWS = 150;
const NOT_READY = "«ارجع لهنا» يحتاج تحديث قاعدة البيانات أول (ملف 0111).";
const internal = `(${[...INTERNAL_ACTORS].join(",")})`;

// what 0111 adds, found missing: not asked again on every save for a while (saves come every few seconds)
const missing = new Map<string, number>();
const isMissing = (k: string) => (missing.get(k) ?? 0) > Date.now();
const markMissing = (k: string) => missing.set(k, Date.now() + 10 * 60_000);

/** The project being saved over, as much as a point needs. */
type Saved = { id: string; version: number; timeline: Timeline };

/** Records a saved change (who, its name, and its steps once 0111 has run). */
export async function logChange(projectId: string, o: { version: number; actor: string; label: string; steps?: unknown }) {
  const row = { project_id: projectId, version: o.version, actor: o.actor.slice(0, 60), label: o.label.slice(0, 200) };
  const steps = readSteps(o.steps);
  if (steps.length && !isMissing("steps")) {
    const { error } = await db().from("editor_ops").insert({ ...row, steps });
    if (!error) return;
    markMissing("steps");
  }
  await db().from("editor_ops").insert(row);
}

/**
 * Keeps the document a save replaces as a point to come back to, when it should (changes-core: shouldSnapshot), and
 * deletes the points past the newest 30. Called only after the save went through, with the project as it was read.
 */
export async function keepPoint(p: Saved, o: { version: number; actor: PageActor | string }) {
  // the project was read at this version and the save replaced exactly it: p.timeline is the document replaced
  if (p.version !== o.version || isMissing("snapshots")) return;
  try {
    const [last, before] = await Promise.all([
      db().from("editor_snapshots").select("version,created_at").eq("project_id", p.id).order("version", { ascending: false }).limit(1).maybeSingle(),
      db().from("editor_ops").select("actor,label").eq("project_id", p.id).eq("version", p.version).not("actor", "in", internal).order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (last.error) return void markMissing("snapshots");
    const keep = shouldSnapshot({
      actor: o.actor,
      before: before.data ? whoDid(before.data as Pick<OpRow, "actor" | "label">) : null,
      last: last.data ? { version: Number(last.data.version), at: Date.parse(String(last.data.created_at)) } : null,
      version: p.version,
      now: Date.now(),
    });
    if (!keep) return;
    const { error } = await db().from("editor_snapshots").insert({ project_id: p.id, version: p.version, timeline: p.timeline });
    if (error) return;
    const { data } = await db().from("editor_snapshots").select("id,version").eq("project_id", p.id);
    const old = toPrune((data ?? []) as { id: number; version: number }[], SNAPSHOT_CAP);
    if (old.length) await db().from("editor_snapshots").delete().in("id", old);
  } catch (e) {
    console.error("editor snapshot", e);
  }
}

/**
 * «سجل التغييرات»: the changes, newest first, and the versions that can be brought back (`points`; null before 0111 —
 * the page then hides «ارجع لهنا» with a note).
 */
export async function changeHistory(projectId: string) {
  const base = "version,actor,label,created_at";
  const read = (cols: string) => db().from("editor_ops").select(cols).eq("project_id", projectId).not("actor", "in", internal).order("id", { ascending: false }).limit(LOG_ROWS);
  let ops = await read(`${base},steps`);
  if (ops.error) ops = await read(base);
  const snaps = await db().from("editor_snapshots").select("version").eq("project_id", projectId).order("version", { ascending: false }).limit(SNAPSHOT_CAP);
  return {
    changes: changeLog((ops.data ?? []) as unknown as OpRow[]),
    points: snaps.error ? null : (snaps.data ?? []).map((s) => Number(s.version)),
  };
}

/**
 * A kept point's document, cleaned against the project's media NOW (a clip on a file deleted since is dropped). The page
 * puts it on the timeline as a new change — saved with its version like any other, so it can be undone and is logged.
 */
export async function pointTimeline(projectId: string, version: unknown) {
  const v = Number(version);
  if (!Number.isInteger(v) || v < 1) throw new UserError("نسخة غير صحيحة.", 400);
  const { data, error } = await db().from("editor_snapshots").select("timeline").eq("project_id", projectId).eq("version", v).maybeSingle();
  if (error) throw new UserError(NOT_READY, 503);
  if (!data) throw new UserError(`هالنقطة ما عاد محفوظة؛ نحفظ آخر ${SNAPSHOT_CAP} نقطة بس.`, 404);
  const { data: assets } = await db().from("editor_assets").select("id,status").eq("project_id", projectId);
  const ids = new Set((assets ?? []).filter((a) => a.status !== "pending").map((a) => a.id as string));
  return { version: v, timeline: readTimeline(data.timeline, ids) };
}

// ---------- «تعليماتي الدايمة» ----------

/** The person's standing instructions to حيدرا ماكس (`stored`: false before 0111 — the page keeps them itself). */
export async function readRules(userId: string): Promise<{ rules: string | null; stored: boolean }> {
  const { data, error } = await db().from("editor_user_settings").select("haidara_rules").eq("user_id", userId).maybeSingle();
  if (error) return { rules: null, stored: false };
  return { rules: data ? String(data.haidara_rules ?? "") : null, stored: true };
}

export async function saveRules(userId: string, v: unknown): Promise<{ rules: string; stored: boolean }> {
  const rules = cleanRules(v);
  const { error } = await db().from("editor_user_settings").upsert({ user_id: userId, haidara_rules: rules, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return { rules, stored: !error };
}

/** What حيدرا ماكس follows on this request: the kept instructions, or (before 0111, or never saved here) the page's copy. */
export async function standingRules(userId: string, fromPage: unknown) {
  const kept = await readRules(userId).catch(() => ({ rules: null, stored: false }));
  return kept.rules ?? cleanRules(fromPage);
}
