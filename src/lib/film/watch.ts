// «رقابة الاستمرارية»: سجاد watches the scenes of a series and links what's missing between them. When a scene's
// screenplay is done (and on «🔍 افحص»), he reads it with the scenes around it (the episode, the one before it) and
// the series' description and characters, and raises alerts — a character who appears without being introduced, a
// jump in time or place with nothing bridging it, an object or state that contradicts an earlier scene, a thread
// opened and never picked up, a name or look that differs from the series' cast — each with what would fix it. The
// alerts pop up on the series' page and on the scene's pages until the person marks them done or dismissed («خل
// سجاد يصلحه» hands the fix to سجاد's intervention). Server only; paid like a سجاد question.

import { randomUUID } from "node:crypto";
import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeJson, claudeCost, claudeTrouble } from "./anthropic";
import { seriesContext } from "./sajjad";
import { episodesOf, scenesOf, type FilmSeries } from "./series";
import { seriesPaid } from "./series-pay";

const db = () => createAdminClient();

export type AlertStatus = "open" | "done" | "dismissed";
export interface ContinuityAlert {
  id: string;
  sceneId: string;
  /** «الحلقة ٢ · المشهد ٣ «العودة»» */
  where: string;
  severity: "high" | "medium" | "low";
  title: string;
  text: string;
  /** what would fix it (the text «خل سجاد يصلحه» hands him) */
  fix: string;
  status: AlertStatus;
  at: string;
}
export interface Watch {
  alerts: ContinuityAlert[];
  /** when each scene was last checked */
  checked?: Record<string, string>;
}

const LIMITS = { perScene: 6, total: 120 } as const;
const ESTIMATE_USD = 0.12;

/** The saved column (jsonb, maybe missing) as a Watch. */
export function readWatch(v: unknown): Watch {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const alerts = (Array.isArray(o.alerts) ? o.alerts : []).filter(
    (a): a is ContinuityAlert => !!a && typeof a === "object" && typeof (a as ContinuityAlert).id === "string" && typeof (a as ContinuityAlert).title === "string" && typeof (a as ContinuityAlert).sceneId === "string",
  );
  const checked = o.checked && typeof o.checked === "object" ? (o.checked as Record<string, string>) : {};
  return { alerts: alerts.map((a) => ({ ...a, status: a.status === "done" || a.status === "dismissed" ? a.status : "open", severity: a.severity === "high" || a.severity === "low" ? a.severity : "medium" })), checked };
}

/** New alerts of a scene replace its open ones (what the person already handled stays); the oldest handled ones fall off. */
export function mergeAlerts(w: Watch, sceneId: string, fresh: ContinuityAlert[], now = new Date().toISOString()): Watch {
  const kept = w.alerts.filter((a) => !(a.sceneId === sceneId && a.status === "open"));
  let alerts = [...kept, ...fresh.slice(0, LIMITS.perScene)];
  let over = alerts.length - LIMITS.total;
  if (over > 0) alerts = alerts.filter((a) => (over > 0 && a.status !== "open" ? (over--, false) : true));
  return { alerts, checked: { ...(w.checked ?? {}), [sceneId]: now } };
}

export const openAlerts = (w: Watch, sceneId?: string) => w.alerts.filter((a) => a.status === "open" && (!sceneId || a.sceneId === sceneId));

async function saveWatch(seriesId: string, w: Watch) {
  const { error } = await db().from("film_series").update({ watch: w }).eq("id", seriesId);
  if (error) throw new UserError("رقابة الاستمرارية تحتاج تجهيز قاعدة البيانات أول (ملف 0038).", 503);
}

const str = { type: "string" } as const;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["alerts"],
  properties: {
    alerts: { type: "array", items: { type: "object", additionalProperties: false, required: ["severity", "title", "text", "fix"], properties: { severity: { type: "string", enum: ["high", "medium", "low"] }, title: str, text: str, fix: str } } },
  },
} as const;

const SYSTEM = `You are «سجاد», the consultant of a series in JAWAD AI's studio, now WATCHING CONTINUITY: you read ONE scene with the scenes around it and the series' description and cast, and you raise only what is really missing or broken BETWEEN scenes (never style notes, never taste):
- a character or place that appears in this scene without ever being introduced or placed (in this scene or an earlier one), or one the series' cast describes differently (name, age, look, relationship);
- a jump in time, place or situation from the scene before (or to the scene after) with nothing bridging it — where did they go, how did they get there, what happened in between;
- an object, injury, state, decision or piece of knowledge that contradicts an earlier scene (he had the key / he lost it; she already knows / she is told again);
- a thread the earlier scenes opened that this scene drops without a word, or a question this scene opens that the next scene never answers;
- a missing scene the story needs between two scenes (say what it must contain).
Each alert: "severity" (high = the audience will be lost or it contradicts the story; medium = a visible gap; low = worth a line), a short Arabic "title", "text" in Gulf Arabic (2–4 lines: what is missing, between which scenes, with the exact names), and "fix": what would mend it, concrete, as an instruction سجاد could carry out («أضف في بداية المشهد ٣ جملة…», «أضف مشهدًا قصيرًا بين…», «غيّر اسم…»). At most 6, the most important first; [] when the scene sits well with its neighbours. Never invent facts that are not in the texts.`;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

async function screenplayOf(projectId: string) {
  const { data } = await db().from("film_versions").select("kind,status,body,version").eq("project_id", projectId).eq("kind", "screenplay").order("version", { ascending: true });
  const rows = (data ?? []) as { status: string; body: string }[];
  return (rows.filter((r) => r.status === "approved").at(-1) ?? rows.at(-1))?.body ?? "";
}

/**
 * سجاد checks one scene against its neighbours; the new alerts replace the scene's open ones. Returns them.
 * `who` pays (the team's coins in a team series).
 */
export async function watchScene(series: FilmSeries, sceneId: string, who: { id: string; email?: string | null }) {
  const { data: row } = await db().from("film_projects").select("id,title,story,scene_number,episode_id").eq("id", sceneId).eq("series_id", series.id).maybeSingle();
  if (!row) throw new UserError("ما لقينا هذا المشهد.", 404);
  const scene = row as { id: string; title: string; story: string; scene_number: number | null; episode_id: string | null };
  const episodes = await episodesOf(series.id);
  const ep = episodes.find((e) => e.id === scene.episode_id);
  const all = await scenesOf(series.id);
  const inEp = (ep ? all.get(ep.id) : null) ?? [];
  const me = inEp.findIndex((s) => s.id === scene.id);
  const near = inEp.filter((_, i) => Math.abs(i - me) <= 2 && i !== me);
  const { data: nearRows } = near.length ? await db().from("film_projects").select("id,title,story,scene_number").in("id", near.map((s) => s.id)) : { data: [] };
  const nearText = await Promise.all(
    ((nearRows ?? []) as { id: string; title: string; story: string; scene_number: number | null }[])
      .sort((a, b) => (a.scene_number ?? 0) - (b.scene_number ?? 0))
      .map(async (r) => `### المشهد ${r.scene_number ?? "؟"} «${r.title}» (${(r.scene_number ?? 0) < (scene.scene_number ?? 0) ? "قبل" : "بعد"})\n${cut(r.story ?? "", 1500)}\n${cut(await screenplayOf(r.id), 2500)}`),
  );
  // the episode before: its scenes' stories, short
  const prevEp = ep ? episodes.filter((e) => e.number < ep.number).at(-1) : null;
  const prevScenes = prevEp ? (all.get(prevEp.id) ?? []) : [];
  const { data: prevRows } = prevScenes.length ? await db().from("film_projects").select("title,story,scene_number").in("id", prevScenes.map((s) => s.id)) : { data: [] };
  const prevText = ((prevRows ?? []) as { title: string; story: string; scene_number: number | null }[]).sort((a, b) => (a.scene_number ?? 0) - (b.scene_number ?? 0)).map((r) => `- المشهد ${r.scene_number ?? "؟"} «${r.title}»: ${cut(r.story ?? "", 500)}`).join("\n");
  const where = `الحلقة ${ep?.number ?? "؟"} · المشهد ${scene.scene_number ?? "؟"} «${scene.title}»`;
  const prompt = [
    `# المشهد المفحوص: ${where}`,
    `## قصته\n${cut(scene.story ?? "", 4000)}`,
    `## سيناريوه\n${cut(await screenplayOf(scene.id), 9000) || "(ما انكتب بعد)"}`,
    nearText.length ? `# المشاهد المجاورة في الحلقة\n${nearText.join("\n\n")}` : "# (ما فيه مشاهد مجاورة بعد)",
    prevText ? `# الحلقة السابقة (${prevEp?.number})\n${prevText}` : "",
    `# المسلسل\n${cut(await seriesContext(series, { full: false }), 12000)}`,
  ].filter(Boolean).join("\n\n");

  let alerts: ContinuityAlert[];
  try {
    alerts = await seriesPaid(series, who, ESTIMATE_USD, "سجاد يراقب الاستمرارية", async () => {
      const r = await callClaudeJson<{ alerts: { severity: "high" | "medium" | "low"; title: string; text: string; fix: string }[] }>({ system: SYSTEM, turns: [{ role: "user", content: prompt }], schema: SCHEMA, maxTokens: 8000, effort: "medium" });
      const now = new Date().toISOString();
      return { value: r.data.alerts.slice(0, LIMITS.perScene).map((a) => ({ id: randomUUID(), sceneId: scene.id, where, severity: a.severity, title: a.title.trim().slice(0, 120), text: a.text.trim().slice(0, 1200), fix: a.fix.trim().slice(0, 1200), status: "open" as const, at: now })), usd: claudeCost(r.usage) };
    });
  } catch (e) {
    if (e instanceof UserError) throw e;
    console.error("sajjad watch", e);
    throw new UserError(claudeTrouble(e) ?? "سجاد ما قدر يفحص الحين؛ جرّب مرة ثانية.", 502);
  }
  const { data: fresh } = await db().from("film_series").select("watch").eq("id", series.id).maybeSingle();
  const w = mergeAlerts(readWatch(fresh?.watch), scene.id, alerts);
  await saveWatch(series.id, w);
  return alerts;
}

/** When a scene's screenplay is done: سجاد checks it by himself (the series' owner pays; nothing stops the scene if it fails). */
export async function watchAfterScreenplay(projectId: string) {
  try {
    const { data: p } = await db().from("film_projects").select("id,series_id,user_id").eq("id", projectId).maybeSingle();
    if (!p?.series_id) return;
    const { data: s } = await db().from("film_series").select("*").eq("id", p.series_id).maybeSingle();
    if (!s) return;
    await watchScene(s as FilmSeries, p.id, { id: (s as FilmSeries).user_id });
  } catch (e) {
    console.error("sajjad watch after screenplay", e);
  }
}

/** «تم» / «تجاهل» / back to open. */
export async function setAlert(series: FilmSeries, alertId: unknown, status: unknown) {
  const st: AlertStatus = status === "done" ? "done" : status === "dismissed" ? "dismissed" : "open";
  const { data } = await db().from("film_series").select("watch").eq("id", series.id).maybeSingle();
  const w = readWatch(data?.watch);
  if (!w.alerts.some((a) => a.id === alertId)) throw new UserError("ما لقينا هذا التنبيه.", 404);
  await saveWatch(series.id, { ...w, alerts: w.alerts.map((a) => (a.id === alertId ? { ...a, status: st } : a)) });
}
