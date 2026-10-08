import type { FilmStage } from "@config/film";

export interface FilmProject {
  id: string;
  user_id: string;
  title: string;
  story: string;
  fixed_facts: string;
  target_duration_sec: number | null;
  stage: FilmStage;
  video_model: "seedance-2.5" | "seedance-2.0";
  /** «المسلسل الذكي»: the series and episode this scene belongs to (null for a standalone film) */
  series_id?: string | null;
  episode_id?: string | null;
  scene_number?: number | null;
  /** «بحث سجاد»: the start's answer and the findings (lib/film/research.ts; migration 0037) */
  research?: unknown;
  created_at: string;
  updated_at: string;
}

export type AssetStatus = "uploaded" | "queued" | "generating" | "generated" | "approved" | "rejected" | "failed";

export interface FilmAsset {
  id: string;
  project_id: string;
  kind: "upload" | "image" | "video" | "audio";
  ref_key: string;
  version_id: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime: string | null;
  bytes: number | null;
  status: AssetStatus;
  error: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type FilmService = "anthropic" | "openai_image" | "seedance" | "elevenlabs";

export interface FilmJob {
  id: string;
  project_id: string;
  user_id: string;
  asset_id: string | null;
  service: FilmService;
  operation: string;
  idempotency_key: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  provider_task_id: string | null;
  attempts: number;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FILM_BUCKET = "film";

/** All of a project's files live under <user>/<project>/. */
export const projectDir = (p: Pick<FilmProject, "user_id" | "id">) => `${p.user_id}/${p.id}`;
