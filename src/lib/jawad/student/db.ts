// «الطالب الذكي» — data access. Server only (service role): every function that takes a user id checks ownership.

import { UserError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { STUDENT } from "@config/jawad/student";

import { storage } from "@/lib/storage";
export const sdb = () => createAdminClient();

export interface Project {
  id: string;
  user_id: string;
  title: string;
  level: string;
  audience: string;
  stage: "sources" | "review" | "understanding" | "scope" | "outputs";
  text_version: number;
  understanding_version: number;
  research_version: number;
  allow_additions: boolean | null;
  web_search: boolean | null;
  last_activity_at: string;
  created_at: string;
}

export interface Source {
  id: string;
  project_id: string;
  user_id: string;
  ord: number;
  kind: "text" | "image" | "pdf";
  name: string;
  path: string | null;
  mime: string;
  bytes: number;
  pages: number;
  body: string | null;
  status: "pending" | "ready" | "rejected";
  pages_done: number;
}

export interface Segment {
  id: string;
  project_id: string;
  source_id: string;
  page: number;
  part: number;
  label: string;
  raw_text: string;
  text: string;
  uncertain: string[];
  status: "pending" | "approved";
}

export interface Version<T = unknown> {
  id: string;
  project_id: string;
  kind: "text" | "understanding" | "research";
  version: number;
  content: T;
  approved: boolean;
  note: string;
  created_at: string;
}

export interface Output {
  id: string;
  project_id: string;
  user_id: string;
  kind: "summary" | "explain" | "transcript" | "book" | "slides" | "audio" | "quiz";
  ord: number;
  title: string;
  settings: Record<string, unknown>;
  status: string;
  depends_on: string | null;
  based_on: { text?: number; understanding?: number; research?: number; dependency?: string };
  stale: boolean;
  plan: unknown;
  plan_approved: boolean;
  trial: unknown;
  trial_coins: number;
  content: unknown;
  files: Record<string, string>;
  approved: boolean;
  requests: { at: string; kind: "edit" | "other"; text: string }[];
  error: string | null;
  created_at: string;
  updated_at: string;
}

export const DELETED = "ما لقينا هذه المادة (قد تكون حُذفت بعد ٣٠ يومًا من آخر نشاط).";

export async function getProject(userId: string, id: string): Promise<Project> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new UserError(DELETED, 404);
  const { data } = await sdb().from("student_projects").select("*").eq("id", id).maybeSingle();
  if (!data || data.user_id !== userId) throw new UserError(DELETED, 404);
  return data as Project;
}

export async function getOutput(userId: string, id: string): Promise<Output> {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new UserError("ما لقينا هذا الناتج.", 404);
  const { data } = await sdb().from("student_outputs").select("*").eq("id", id).maybeSingle();
  if (!data || data.user_id !== userId) throw new UserError("ما لقينا هذا الناتج.", 404);
  return data as Output;
}

export async function touch(projectId: string, patch: Partial<Project> = {}) {
  await sdb().from("student_projects").update({ ...patch, last_activity_at: new Date().toISOString() }).eq("id", projectId);
}

export async function sources(projectId: string): Promise<Source[]> {
  const { data } = await sdb().from("student_sources").select("*").eq("project_id", projectId).order("ord");
  return (data ?? []) as Source[];
}

/** All segments in reading order: by source order, then page, then part. */
export async function segments(projectId: string): Promise<Segment[]> {
  const [srcs, { data }] = await Promise.all([
    sources(projectId),
    sdb().from("student_segments").select("id,project_id,source_id,page,part,label,raw_text,text,uncertain,status").eq("project_id", projectId),
  ]);
  const ord = new Map(srcs.map((s) => [s.id, s.ord]));
  return ((data ?? []) as Segment[]).sort((a, b) => (ord.get(a.source_id) ?? 0) - (ord.get(b.source_id) ?? 0) || a.page - b.page || a.part - b.part);
}

export async function latestVersion<T>(projectId: string, kind: Version["kind"], approvedOnly = false): Promise<Version<T> | null> {
  let q = sdb().from("student_versions").select("*").eq("project_id", projectId).eq("kind", kind);
  if (approvedOnly) q = q.eq("approved", true);
  const { data } = await q.order("version", { ascending: false }).limit(1).maybeSingle();
  return (data as Version<T>) ?? null;
}

export async function versionOf<T>(projectId: string, kind: Version["kind"], version: number): Promise<Version<T> | null> {
  const { data } = await sdb().from("student_versions").select("*").eq("project_id", projectId).eq("kind", kind).eq("version", version).maybeSingle();
  return (data as Version<T>) ?? null;
}

export async function addVersion<T>(project: Project, kind: Version["kind"], content: T, note = ""): Promise<Version<T>> {
  const last = await latestVersion(project.id, kind);
  const { data, error } = await sdb()
    .from("student_versions")
    .insert({ project_id: project.id, user_id: project.user_id, kind, version: (last?.version ?? 0) + 1, content, note })
    .select("*")
    .single();
  if (error) throw error;
  return data as Version<T>;
}

export async function outputs(projectId: string): Promise<Output[]> {
  const { data } = await sdb().from("student_outputs").select("*").eq("project_id", projectId).order("ord");
  return (data ?? []) as Output[];
}

export async function saveOutput(id: string, patch: Partial<Output>, history?: { kind: string; snapshot: unknown; userId: string }) {
  await sdb().from("student_outputs").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (history) await sdb().from("student_output_history").insert({ output_id: id, user_id: history.userId, kind: history.kind, snapshot: history.snapshot ?? {} });
}

// ───────────────────────────── files ─────────────────────────────

export async function putFile(path: string, body: Buffer | Uint8Array | string, contentType: string) {
  const { error } = await storage.from(STUDENT.bucket).upload(path, body, { contentType, upsert: true });
  if (error) throw error;
}

export async function getFile(path: string): Promise<Buffer> {
  const { data, error } = await storage.from(STUDENT.bucket).download(path);
  if (error || !data) throw error ?? new Error("file not found");
  return Buffer.from(await data.arrayBuffer());
}

export async function signFile(path: string, seconds = 600, download?: string) {
  const { data, error } = await storage.from(STUDENT.bucket).createSignedUrl(path, seconds, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function removeFolder(prefix: string) {
  const store = storage.from(STUDENT.bucket);
  // Supabase lists one folder level at a time
  const walk = async (dir: string): Promise<string[]> => {
    const { data } = await store.list(dir, { limit: 1000 });
    const out: string[] = [];
    for (const f of data ?? []) {
      const p = `${dir}/${f.name}`;
      if (f.id) out.push(p);
      else out.push(...(await walk(p)));
    }
    return out;
  };
  const files = await walk(prefix);
  for (let i = 0; i < files.length; i += 100) await store.remove(files.slice(i, i + 100));
}

/** The approved full text, as one string with page markers (what every later stage reads). */
export interface TextVersion {
  segments: { id: string; label: string; text: string }[];
}
export const joinText = (t: TextVersion, markers = true) => t.segments.map((s) => (markers ? `[${s.id.slice(0, 8)} · ${s.label}]\n${s.text}` : s.text)).join("\n\n");
