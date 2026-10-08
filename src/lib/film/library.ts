// «المكتبة»: everything the scene ever made, kept — the texts (story, screenplay, every sheet's and shot's prompt),
// the pictures (style tests, sheets, the person's own uploads), the videos (every take) and the voices. Going back a
// step never empties it: what the new work replaced stays here, marked as an older version. Server only.

import { createAdminClient } from "@/lib/supabase/admin";
import { storage } from "@/lib/storage";
import { FILM_BUCKET, type FilmAsset, type FilmProject } from "./types";

const db = () => createAdminClient();

export interface LibraryItem {
  id: string;
  kind: "text" | "image" | "video" | "audio";
  /** which step it belongs to */
  step: "story" | "script" | "sheets" | "director" | "videos" | "voices" | "edit";
  title: string;
  /** a short line under the title (status, size, what it is) */
  note: string;
  /** the text itself (texts), or the file's short-lived link */
  text?: string;
  url?: string;
  /** approved = the one in use now; older = replaced, kept here; archived = from before a rewind */
  state: "approved" | "current" | "older" | "archived" | "failed";
  at: string;
}

const STEP_OF_STAGE: Record<string, LibraryItem["step"]> = { screenwriter: "script", sheets: "sheets", director: "director" };
const KIND_TITLE: Record<string, string> = {
  understanding: "فهم السيناريست", questions: "أسئلة السيناريست", story: "القصة المطوّرة", screenplay: "السيناريو", handoff: "تسليم السيناريست",
  sheet_understanding: "خريطة الشيتات", sheet_questions: "أسئلة التصميم", style_test: "لقطة اختبار الستايل", style: "الستايل المعتمد", sheet_prompt: "وصف شيت", sheet_handoff: "تسليم صانع الشيت",
  dir_understanding: "فهم المخرج", dir_questions: "أسئلة الإخراج", dir_map: "خريطة اللقطات", dir_generation: "لقطة", dir_note: "ملاحظة المخرج",
};

export async function filmLibrary(project: FilmProject): Promise<LibraryItem[]> {
  const [{ data: vers }, { data: assets }] = await Promise.all([
    db().from("film_versions").select("id,stage,kind,ref_key,version,body,data,status,created_at").eq("project_id", project.id).order("created_at", { ascending: false }),
    db().from("film_assets").select("*").eq("project_id", project.id).order("created_at", { ascending: false }),
  ]);
  const out: LibraryItem[] = [];
  out.push({ id: "story", kind: "text", step: "story", title: "قصتك", note: `${project.story.length} حرف`, text: project.story, state: "approved", at: project.created_at });
  if (project.fixed_facts) out.push({ id: "facts", kind: "text", step: "story", title: "أشياء ثابتة", note: "", text: project.fixed_facts, state: "approved", at: project.created_at });
  const V = (vers ?? []) as { id: string; stage: string; kind: string; ref_key: string; version: number; body: string; data: Record<string, unknown>; status: string; created_at: string }[];
  for (const v of V) {
    const step = STEP_OF_STAGE[v.stage];
    if (!step || v.kind === "dir_setup" || v.kind.endsWith("handoff")) continue;
    const text = typeof v.data.prompt === "string" && v.data.prompt ? `${v.body}\n\n---\n${v.data.prompt}` : v.body;
    if (!text.trim()) continue;
    out.push({
      id: v.id, kind: "text", step, title: `${KIND_TITLE[v.kind] ?? v.kind}${v.ref_key ? ` ${v.ref_key}` : ""}`, note: `النسخة ${v.version}`, text,
      state: v.status === "approved" ? "approved" : v.status === "awaiting_approval" ? "current" : "older", at: v.created_at,
    });
  }
  const A = ((assets ?? []) as FilmAsset[]).filter((a) => a.storage_path && a.status !== "generating" && a.status !== "queued");
  const links = A.length ? ((await storage.from(FILM_BUCKET).createSignedUrls(A.map((a) => a.storage_path!), 3600)).data ?? []) : [];
  for (const [i, a] of A.entries()) {
    const url = links[i]?.signedUrl;
    if (!url) continue;
    const archived = a.ref_key.startsWith("archive:");
    const ref = archived ? a.ref_key.slice(8) : a.ref_key;
    const isScene = ref === "SCENE";
    const step: LibraryItem["step"] = a.kind === "video" ? (isScene ? "edit" : "videos") : a.kind === "audio" ? "voices" : "sheets";
    const title = a.kind === "video" ? (isScene ? "المشهد الناجح" : `فيديو ${ref}`) : a.kind === "audio" ? `صوت ${ref.replace(/^line:/, "").replace(/^track:/, "حوار ")}` : ref === "STYLE-TEST" ? `اختبار ستايل${a.meta?.styleId ? ` · ${a.meta.styleId}` : ""}` : a.kind === "upload" ? `صورتك لـ${ref}` : `صورة ${ref}`;
    const state: LibraryItem["state"] = archived ? "archived" : a.status === "approved" ? "approved" : a.status === "failed" ? "failed" : a.status === "generated" || a.status === "uploaded" ? "current" : "older";
    const note = [typeof a.meta?.at_name === "string" ? a.meta.at_name : "", a.meta?.resolution ? String(a.meta.resolution) : "", a.meta?.durationSec ? `${a.meta.durationSec} ث` : ""].filter(Boolean).join(" · ");
    out.push({ id: a.id, kind: a.kind === "upload" ? "image" : a.kind, step, title, note, url, state, at: a.created_at });
  }
  return out.sort((x, y) => y.at.localeCompare(x.at));
}
