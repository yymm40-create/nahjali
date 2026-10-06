"use client";

// «الممنتج الذكي»'s plug-in point: a tool added here gets a button in the top bar and changes the timeline only through
// the editor's own commands, so every result is checked, saved, and undone with one tap like any other change.
// None ship yet; a tool is one object in PLUGINS:
//
//   { id: "my-tool", label: "اسم الأداة", hint: "وش تسوي", run: ({ tl, selected, playhead }) => [{ type: "split", at: playhead }] }
//
// `run` may be async (a call to the site's own API); throwing an Error shows its message to the person.

import { useState } from "react";
import type { Command } from "@/lib/editor/commands";
import type { Timeline } from "@/lib/editor/model";
import Icon from "../Icon";
import type { Run } from "./Inspector";
import type { EditorAsset } from "./types";

export interface PluginContext {
  projectId: string;
  tl: Timeline;
  selected: string[];
  playhead: number;
  assets: Map<string, EditorAsset>;
}

export interface EditorPlugin {
  id: string;
  label: string;
  hint?: string;
  /** hidden unless this says yes (e.g. only with a clip selected) */
  enabled?: (ctx: PluginContext) => boolean;
  run: (ctx: PluginContext) => Command[] | Promise<Command[]>;
}

export const PLUGINS: EditorPlugin[] = [];

/** The plug-ins' buttons (nothing at all while there are none). */
export function PluginTools({ plugins = PLUGINS, ctx, run, flash, readOnly }: { plugins?: EditorPlugin[]; ctx: () => PluginContext; run: Run; flash: (m: string, bad?: boolean) => void; readOnly: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  if (!plugins.length) return null;
  const go = async (p: EditorPlugin) => {
    setBusy(p.id);
    try {
      const cmds = await p.run(ctx());
      if (cmds.length) run(cmds, { label: p.label });
    } catch (e) {
      flash(e instanceof Error ? e.message : "تعذّر.", true);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      {plugins.map((p) => (
        <button key={p.id} type="button" className="jw-btn shrink-0" disabled={readOnly || !!busy || (p.enabled ? !p.enabled(ctx()) : false)} title={p.hint} onClick={() => void go(p)}>
          {busy === p.id ? <span className="jw-spinner" /> : <Icon name="sparkles" size={16} />} <span className="hidden sm:inline">{p.label}</span>
        </button>
      ))}
    </>
  );
}
