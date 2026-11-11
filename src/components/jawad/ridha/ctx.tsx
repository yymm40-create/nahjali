"use client";

// «الرضا فويس» — what every panel of the studio shares: the engine, the project and its store, what is selected,
// and `work()` — the one way a long job runs (a progress card, the page kept responsive, an error said in words).

import { createContext, useContext } from "react";
import type { Clip, Project, Track } from "@/lib/ridha/model";
import type { Engine } from "./engine";
import type { Store } from "./store";

export type PanelId = "max" | "mixer" | "editor" | "eq" | "fx" | "tune" | "clean" | "harmony" | "arrange" | "voice" | "smart" | "master" | "lyrics" | "export";

export interface Studio {
  engine: Engine;
  store: Store;
  project: Project;
  /** selected clips (the first is «the» clip the tools work on) and the selected track */
  selClips: string[];
  selTrack: string;
  select(clips: string[], track?: string): void;
  clip: Clip | null;
  track: Track | null;
  panel: PanelId;
  openPanel(p: PanelId): void;
  /** Runs a long job behind a progress card. `say(done 0–1, what)` moves the bar. Returns what the job returns, or null if it failed. */
  work<T>(title: string, job: (say: (done: number, what?: string) => void) => Promise<T>): Promise<T | null>;
  toast(text: string): void;
  /** The selected clip's own stretch of sound (what is between its edges), as channels. */
  clipSound(c: Clip): Float32Array[] | null;
  /** Replaces the clip's sound by a processed version of the same passage (one undo step). */
  applyToClip(c: Clip, channels: Float32Array[], label: string): void;
}

export const StudioCtx = createContext<Studio | null>(null);
export function useStudio(): Studio {
  const s = useContext(StudioCtx);
  if (!s) throw new Error("outside the studio");
  return s;
}
