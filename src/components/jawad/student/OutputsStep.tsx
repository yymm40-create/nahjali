"use client";

import { useState } from "react";
import Icon from "@/components/jawad/Icon";
import { OUTPUT_KINDS, OUTPUT_STATUS } from "@config/jawad/student";
import { KIND_LOOK, Tile } from "./look";
import OutputPanel from "./OutputPanel";
import type { ProjectHook } from "./StudentProject";
import { ErrorLine, useAsync } from "./ui";

export default function OutputsStep({ p }: { p: ProjectHook }) {
  const { outputs, jobs } = p.state;
  const [pick, setPick] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(outputs.find((o) => o.status !== "done")?.id ?? outputs[0]?.id ?? null);
  const { busy, error, run } = useAsync();
  // the open output: the one picked, else the first still to do — and when the open one is approved, the next opens
  const firstOpen = outputs.find((o) => o.status !== "done") ?? outputs[0] ?? null;
  const [seenStatus, setSeenStatus] = useState<Record<string, string>>({});
  const current = outputs.find((o) => o.id === open);
  if (current && seenStatus[current.id] !== current.status) {
    const was = seenStatus[current.id];
    setSeenStatus({ ...seenStatus, [current.id]: current.status });
    if (was && was !== "done" && current.status === "done") {
      const next = outputs.find((o) => o.ord > current.ord && o.status !== "done");
      if (next) setOpen(next.id);
    }
  }
  const selected = current ?? firstOpen;

  const move = (id: string, d: -1 | 1) => {
    const ids = outputs.map((o) => o.id);
    const i = ids.indexOf(id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    return run(() => p.act({ action: "outputs_order", ids }));
  };

  return (
    <div className="space-y-4">
      <section className="jw-panel space-y-3 p-4">
        <h2 className="font-semibold">اختر النواتج (واحد أو أكثر)</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {OUTPUT_KINDS.map((k) => {
            const on = pick.includes(k.kind);
            return (
              <button
                key={k.kind}
                type="button"
                aria-pressed={on}
                onClick={() => setPick(on ? pick.filter((x) => x !== k.kind) : [...pick, k.kind])}
                className={`relative flex items-start gap-3 rounded-2xl border bg-white p-4 text-start transition-all hover:-translate-y-0.5 ${on ? "border-transparent ring-4 ring-violet-300" : "border-jw-line"}`}
              >
                <Tile emoji={KIND_LOOK[k.kind].emoji} grad={KIND_LOOK[k.kind].grad} size={44} />
                <span className="min-w-0">
                  <b className="block">{k.name}</b>
                  <span className="block text-xs text-jw-muted">{k.blurb}</span>
                </span>
                {on && (
                  <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full text-white" style={{ background: "var(--st-grad)" }}>
                    <Icon name="check" size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <ErrorLine error={error} />
        <button type="button" className="jw-btn jw-btn-primary" disabled={!pick.length || busy} onClick={() => run(async () => { await p.act({ action: "outputs_add", kinds: pick }); setPick([]); setOpen(null); setTimeout(() => document.getElementById("st-queue")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); })}>
          <Icon name="plus" size={16} /> أضف إلى الطابور ({pick.length})
        </button>
      </section>

      {outputs.length > 0 && (
        <div id="st-queue" className="grid scroll-mt-24 gap-4 lg:grid-cols-[300px_1fr]">
          <aside className="jw-panel h-fit space-y-2 p-3">
            <h2 className="text-sm font-semibold">طابور التنفيذ (بالترتيب، واحد بعد الآخر)</h2>
            <ol className="space-y-1">
              {outputs.map((o, i) => {
                const job = jobs.find((j) => j.outputId === o.id && (j.status === "queued" || j.status === "running"));
                return (
                  <li key={o.id} className={`flex items-center gap-1 rounded-lg p-2 ${open === o.id ? "bg-jw-surface-3" : "hover:bg-jw-surface-2"}`}>
                    <Tile emoji={KIND_LOOK[o.kind].emoji} grad={KIND_LOOK[o.kind].grad} size={32} />
                    <button type="button" className="min-w-0 flex-1 text-start" onClick={() => { setOpen(o.id); setTimeout(() => document.getElementById(`o-${o.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}>
                      <b className="block truncate text-sm">
                        {i + 1}. {o.title}
                      </b>
                      <span className={`block text-xs ${o.status === "done" ? "text-jw-ok" : o.status === "failed" ? "text-jw-danger" : "text-jw-muted"}`}>
                        {job ? job.stage || "جارٍ" : OUTPUT_STATUS[o.status] ?? o.status}
                        {o.stale ? " · يحتاج إعادة اعتماد" : ""}
                      </span>
                    </button>
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأعلى" disabled={i === 0 || busy} onClick={() => move(o.id, -1)}>
                      <Icon name="chevronDown" size={12} className="rotate-180" />
                    </button>
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="لأسفل" disabled={i === outputs.length - 1 || busy} onClick={() => move(o.id, 1)}>
                      <Icon name="chevronDown" size={12} />
                    </button>
                    <button type="button" className="jw-btn jw-btn-quiet jw-btn-icon" aria-label="حذف" disabled={busy || Boolean(job)} onClick={() => confirm(`حذف «${o.title}»؟`) && run(() => p.act({ action: "output_remove", outputId: o.id }))}>
                      <Icon name="trash" size={12} />
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
          {selected && <OutputPanel key={selected.id} p={p} o={selected} />}
        </div>
      )}
    </div>
  );
}
