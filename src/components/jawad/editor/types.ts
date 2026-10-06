// «الممنتج الذكي» — what the pages get from the server (types only: nothing of the server's code reaches the browser).
export type { AssetView as EditorAsset, ImportItem, ProjectSummary } from "@/lib/editor/server";
import type { ProjectSummary } from "@/lib/editor/server";
import type { Timeline } from "@/lib/editor/model";

export type EditorProjectView = ProjectSummary & { version: number; timeline: Timeline };
