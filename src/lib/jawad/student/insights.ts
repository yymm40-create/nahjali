// «الطالب الذكي» — the owner's statistics: who came (by email), how many today, where each student got to, what they
// made, where they stopped, and their feedback. No files, only what happened. Server only (service role).

import { createAdminClient } from "@/lib/supabase/admin";
import { outputName, OUTPUT_STATUS } from "@config/jawad/student";

const STAGE_NAME: Record<string, string> = {
  sources: "إضافة المادة",
  review: "مراجعة النص",
  understanding: "الفهم",
  scope: "حدود المصدر",
  outputs: "النواتج",
};
export const stageName = (s: string) => (s === "home" ? "الصفحة الرئيسية للفرع" : (STAGE_NAME[s] ?? s));

type Row = Record<string, unknown>;

/** Midnight today in Saudi time (UTC+3), as an ISO string. */
function todayStart() {
  const now = new Date(Date.now() + 3 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 3 * 3600_000).toISOString();
}

async function emails(ids: string[]) {
  const db = createAdminClient();
  const map = new Map<string, string>();
  const want = new Set(ids);
  for (let page = 1; page <= 20 && map.size < want.size; page++) {
    const { data } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    for (const u of data?.users ?? []) if (want.has(u.id)) map.set(u.id, u.email ?? "");
    if (!data || data.users.length < 1000) break;
  }
  return map;
}

export interface PersonStats {
  userId: string;
  email: string;
  firstSeen: string | null;
  lastSeen: string | null;
  visits: number;
  projects: {
    id: string;
    title: string;
    level: string;
    stage: string;
    created: string;
    last: string;
    pages: number;
    outputs: { kind: string; status: string; designed: boolean }[];
    failed: { kind: string; error: string }[];
  }[];
  feedback: { rating: number | null; message: string; stage: string; at: string }[];
}

export async function studentInsights() {
  const db = createAdminClient();
  const today = todayStart();
  const [visits, projects, outputs, jobs, segments, feedback] = await Promise.all([
    db.from("student_visits").select("user_id,visitor,created_at").order("created_at", { ascending: false }).limit(20000),
    db.from("student_projects").select("id,user_id,title,level,stage,created_at,last_activity_at"),
    db.from("student_outputs").select("id,project_id,user_id,kind,status,files,created_at,updated_at"),
    db.from("student_jobs").select("project_id,output_id,user_id,kind,status,error,created_at").eq("status", "failed"),
    db.from("student_segments").select("project_id"),
    db.from("student_feedback").select("user_id,project_id,stage,rating,message,created_at").order("created_at", { ascending: false }).limit(2000),
  ]);
  const migrated = !visits.error && !feedback.error;
  const V = (visits.data ?? []) as Row[];
  const P = (projects.data ?? []) as Row[];
  const O = (outputs.data ?? []) as Row[];
  const J = (jobs.data ?? []) as Row[];
  const S = (segments.data ?? []) as Row[];
  const F = (feedback.data ?? []) as Row[];

  const isToday = (r: Row) => String(r.created_at) >= today;
  const ids = new Set<string>();
  for (const r of [...V, ...P, ...F]) if (r.user_id) ids.add(String(r.user_id));
  const mail = await emails([...ids]);

  const pagesOf = new Map<string, number>();
  for (const s of S) pagesOf.set(String(s.project_id), (pagesOf.get(String(s.project_id)) ?? 0) + 1);

  const people = new Map<string, PersonStats>();
  const person = (uid: string) => {
    let p = people.get(uid);
    if (!p) people.set(uid, (p = { userId: uid, email: mail.get(uid) ?? "(حساب محذوف)", firstSeen: null, lastSeen: null, visits: 0, projects: [], feedback: [] }));
    return p;
  };
  for (const v of V) {
    if (!v.user_id) continue;
    const p = person(String(v.user_id));
    p.visits++;
    const at = String(v.created_at);
    if (!p.firstSeen || at < p.firstSeen) p.firstSeen = at;
    if (!p.lastSeen || at > p.lastSeen) p.lastSeen = at;
  }
  for (const pr of P) {
    const p = person(String(pr.user_id));
    const mine = O.filter((o) => o.project_id === pr.id);
    p.projects.push({
      id: String(pr.id),
      title: String(pr.title),
      level: String(pr.level),
      stage: String(pr.stage),
      created: String(pr.created_at),
      last: String(pr.last_activity_at),
      pages: pagesOf.get(String(pr.id)) ?? 0,
      outputs: mine.map((o) => ({ kind: String(o.kind), status: String(o.status), designed: Boolean((o.files as Row | null)?.pictures_pdf) })),
      failed: J.filter((j) => j.project_id === pr.id).map((j) => ({ kind: String(j.kind), error: String(j.error ?? "") })),
    });
    if (!p.lastSeen || String(pr.last_activity_at) > p.lastSeen) p.lastSeen = String(pr.last_activity_at);
  }
  for (const f of F) {
    if (!f.user_id) continue;
    person(String(f.user_id)).feedback.push({ rating: (f.rating as number | null) ?? null, message: String(f.message), stage: String(f.stage), at: String(f.created_at) });
  }

  // where they are: the stage of each material, and for materials at the outputs, the state of each output
  const stages = Object.keys(STAGE_NAME).map((s) => ({ stage: s, name: STAGE_NAME[s], count: P.filter((p) => p.stage === s).length }));
  const kinds = [...new Set(O.map((o) => String(o.kind)))].map((k) => {
    const mine = O.filter((o) => o.kind === k);
    const by = (st: string[]) => mine.filter((o) => st.includes(String(o.status))).length;
    return {
      kind: k,
      name: outputName(k),
      total: mine.length,
      done: by(["done"]),
      made: by(["review", "done"]),
      inProgress: by(["planning", "running", "trial_running"]),
      waiting: by(["settings", "waiting", "plan_review", "ready", "trial_offer", "trial_review"]),
      failed: by(["failed"]),
      designed: mine.filter((o) => (o.files as Row | null)?.pictures_pdf).length,
    };
  });
  const stuck = O.filter((o) => !["done"].includes(String(o.status))).reduce<Record<string, number>>((acc, o) => {
    const k = OUTPUT_STATUS[String(o.status)] ?? String(o.status);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return {
    migrated,
    today: {
      visitors: new Set(V.filter(isToday).map((v) => String(v.visitor))).size,
      signedIn: new Set(V.filter((v) => isToday(v) && v.user_id).map((v) => String(v.user_id))).size,
      materials: P.filter(isToday).length,
      outputsMade: O.filter((o) => String(o.updated_at) >= today && ["review", "done"].includes(String(o.status))).length,
      feedback: F.filter(isToday).length,
    },
    total: {
      visitors: new Set(V.map((v) => String(v.visitor))).size,
      people: people.size,
      materials: P.length,
      outputs: O.length,
      outputsMade: O.filter((o) => ["review", "done"].includes(String(o.status))).length,
      failedJobs: J.length,
      feedback: F.length,
      avgRating: (() => {
        const r = F.map((f) => f.rating as number | null).filter((x): x is number => typeof x === "number");
        return r.length ? Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10 : null;
      })(),
    },
    stages,
    kinds,
    stuck,
    people: [...people.values()].sort((a, b) => String(b.lastSeen ?? "").localeCompare(String(a.lastSeen ?? ""))),
    anonymousFeedback: F.filter((f) => !f.user_id).map((f) => ({ rating: (f.rating as number | null) ?? null, message: String(f.message), stage: String(f.stage), at: String(f.created_at) })),
  };
}
