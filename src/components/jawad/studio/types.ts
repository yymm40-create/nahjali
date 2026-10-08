import type { RefKind, RefMeta, RefRole, RefStyle, Settings } from "@config/jawad/types";
import type { JobView, WorkItem } from "@/lib/jawad/labels";

/** A generator as the studio receives it from the server (capabilities come from the shared registry by id). */
export interface StudioGenerator {
  id: string;
  name: string;
  sampleUrl: string | null;
  live: boolean;
  reason: string | null;
}

export interface StudioProps {
  section: { id: string; name: string; output: "image" | "video" | "audio" };
  generators: StudioGenerator[];
  prices: Record<string, Record<string, number | null>>;
  user: { id: string } | null;
  owner: boolean;
  allowed: boolean;
  balance: number | null;
  initialWorks: { items: WorkItem[]; next: string | null } | null;
}

/** A stored upload as the server returns it (with a short-lived link). */
export interface UploadView {
  id: string;
  kind: RefKind;
  fileName: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fps: number | null;
  status: "pending" | "ready" | "rejected";
  error: string | null;
  url: string | null;
}

/** One reference in the strip: uploading, being checked on the server, ready, or refused. */
export interface RefItem {
  localId: string;
  uploadId: string | null;
  kind: RefKind;
  /** Its name in the prompt («@image1», or one the user chose). */
  name: string;
  role: RefRole;
  fileName: string;
  status: "uploading" | "checking" | "ready" | "rejected" | "error" | "missing";
  progress: number;
  error: string | null;
  url: string | null;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fps: number | null;
}

/** What is kept in the browser between visits (per user and section). Files themselves live on the server. */
export interface Draft {
  generatorId: string;
  prompt: string;
  instructions: string;
  settings: Record<string, Settings>;
  refStyle: Record<string, RefStyle>;
  refs: RefItem[];
}

export const refMeta = (r: RefItem): RefMeta => ({
  id: r.uploadId ?? r.localId,
  kind: r.kind,
  role: r.role,
  name: r.name,
  mime: r.mime,
  bytes: r.bytes,
  width: r.width,
  height: r.height,
  durationMs: r.durationMs,
  fps: r.fps,
  status: r.status === "ready" ? "ready" : r.status === "uploading" || r.status === "checking" ? "pending" : "rejected",
});

export type { JobView, WorkItem };
