import type { Pricing } from "@config/coins";
import type { StudioGenerator } from "../studio/types";

export interface CanvasProps {
  generators: StudioGenerator[];
  prices: Record<string, Record<string, number | null>>;
  pricing: Pricing;
  user: { id: string } | null;
  /** nothing is charged (the owner, an unlimited account) */
  owner: boolean;
  allowed: boolean;
  balance: number | null;
}

/** Where a node stands in this page's run (not kept: a reopened canvas shows its kept results only). */
export interface NodeStatus {
  state: "queued" | "working" | "done" | "failed" | "skipped" | "manual";
  note?: string;
  error?: string;
}

/** The board's camera: screen = (t + s · view position). */
export interface Viewport {
  x: number;
  y: number;
  s: number;
}
