"use client";

// «الممنتج الذكي»'s plug-in point: a tool added here shows in «أساليب جاهزة» and changes the timeline only through the
// editor's own commands, so every result is checked, saved, and undone with one tap like any other change.
// A tool is one object in PLUGINS:
//
//   { id: "my-tool", label: "اسم الأداة", hint: "وش تسوي", run: ({ tl, selected, playhead }) => [{ type: "split", at: playhead }] }
//
// `run` may be async (a call to the site's own API); throwing an Error shows its message to the person. A tool that
// needs Claude's judgement (what is said, what to keep) hands it a request with `ctx.ask(...)` instead.

import { useEffect, useRef, useState } from "react";
import type { Command } from "@/lib/editor/commands";
import type { AssetInfo, Timeline } from "@/lib/editor/model";
import Icon from "../Icon";
import type { Run } from "./Inspector";
import { RECIPES } from "./recipes";
import type { EditorAsset } from "./types";

export interface PluginContext {
  projectId: string;
  tl: Timeline;
  selected: string[];
  playhead: number;
  assets: Map<string, EditorAsset>;
  infos: Map<string, AssetInfo>;
  /** sends a request to Claude (the panel opens and shows the answer) */
  ask: (message: string) => void;
}

export interface EditorPlugin {
  id: string;
  label: string;
  icon?: string;
  hint?: string;
  /** who made it (shown under the list) */
  credit?: string;
  /** hidden unless this says yes (e.g. only with a clip selected) */
  enabled?: (ctx: PluginContext) => boolean;
  run: (ctx: PluginContext) => Command[] | Promise<Command[]>;
}

export const PLUGINS: EditorPlugin[] = [...RECIPES];

/** «أساليب جاهزة»: the plug-ins in one menu (nothing at all while there are none). */
export function PluginTools({ plugins = PLUGINS, ctx, run, flash, readOnly, inline = false, className = "" }: { plugins?: EditorPlugin[]; ctx: () => PluginContext; run: Run; flash: (m: string, bad?: boolean) => void; readOnly: boolean; /** the list itself (a side panel), not a button with a menu */ inline?: boolean; className?: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);
  if (!plugins.length) return null;
  const go = async (p: EditorPlugin) => {
    setOpen(false);
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
  const credits = [...new Set(plugins.map((p) => p.credit).filter(Boolean))];
  const list = (
    <>
      {plugins.map((p) => {
        const off = readOnly || !!busy || (p.enabled ? !p.enabled(ctx()) : false);
        return (
          <button key={p.id} type="button" role="menuitem" disabled={off} onClick={() => void go(p)} className={`flex w-full items-start gap-2 rounded-xl px-2 py-2 text-start hover:bg-jw-surface-2 disabled:opacity-40 ${inline ? "jw-3d bg-jw-surface" : ""}`}>
            <span className="text-lg leading-6">{busy === p.id ? <span className="jw-spinner" /> : (p.icon ?? "✨")}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{p.label}</span>
              {p.hint && <span className="block text-[11px] leading-4 text-jw-muted">{p.hint}</span>}
            </span>
          </button>
        );
      })}
      {credits.length > 0 && <p className="border-t border-jw-line px-2 pt-1.5 text-[10px] text-jw-faint">{credits.join(" · ")}</p>}
    </>
  );
  if (inline)
    return (
      <div role="menu" aria-label="أساليب جاهزة" className={`space-y-1.5 p-3 ${className}`}>
        <p className="text-xs leading-5 text-jw-muted">أساليب مونتاج بضغطة وحدة. كل وحدة تتراجع عنها بضغطة.</p>
        {list}
      </div>
    );
  return (
    <div ref={box} className={`relative shrink-0 ${className}`}>
      <button type="button" className="jw-btn" disabled={readOnly || !!busy} onClick={() => setOpen((v) => !v)} aria-expanded={open} title="أساليب مونتاج جاهزة بضغطة">
        {busy ? <span className="jw-spinner" /> : <Icon name="sparkles" size={16} />} <span className="hidden sm:inline">أساليب جاهزة</span>
      </button>
      {open && (
        <div role="menu" aria-label="أساليب جاهزة" className="absolute end-0 top-full z-50 mt-1 w-72 space-y-0.5 rounded-xl border border-jw-line bg-jw-surface p-1.5 shadow-2xl">
          {list}
        </div>
      )}
    </div>
  );
}
