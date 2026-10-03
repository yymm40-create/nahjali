"use client";

import { useState } from "react";
import { MAHDI_LIMITS, PROJECT_COLORS, PROJECT_SUGGESTIONS, type ProjectColor } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import type { Project } from "@/lib/mahdi/types";
import IconPicker from "./IconPicker";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

/** Create or edit a project (name, icon, colour). */
export default function ProjectForm({
  open,
  onClose,
  project,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
  onSaved?: (id: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={project ? t.project.editTitle : t.project.newTitle}>
      {open && <Form project={project} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function Form({ project, onClose, onSaved }: { project?: Project; onClose: () => void; onSaved?: (id: string) => void }) {
  const { store, state, toast } = useMahdi();
  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState(project?.icon ?? "");
  const [color, setColor] = useState<ProjectColor>(project?.color ?? PROJECT_COLORS[state.snap.projects.length % PROJECT_COLORS.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taken = new Set(state.snap.projects.map((p) => p.name));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const body = { name: name.trim(), icon, color };
      if (project) {
        await store.mutate(`/api/mahdi/projects/${project.id}`, "PATCH", body);
        toast(t.common.saved);
        onSaved?.(project.id);
      } else {
        const res = await store.mutate<{ id: string }>("/api/mahdi/projects", "POST", body);
        onSaved?.(res.id);
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="m-label">{t.project.name}</span>
        <input className="m-field" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAHDI_LIMITS.projectNameMax} placeholder={t.project.namePlaceholder} required autoFocus={!project} />
      </label>
      {!project && (
        <div className="flex flex-wrap gap-2">
          {PROJECT_SUGGESTIONS.filter((s) => !taken.has(s.name)).map((s) => (
            <button
              key={s.name}
              type="button"
              className="m-chip min-h-10 px-3"
              aria-pressed={name === s.name}
              onClick={() => {
                setName(s.name);
                setIcon(s.icon);
              }}
            >
              <span aria-hidden="true">{s.icon}</span> {s.name}
            </button>
          ))}
        </div>
      )}
      <IconPicker value={icon} onChange={setIcon} label={t.project.icon} />
      <fieldset>
        <legend className="m-label">{t.project.color}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.project.color}>
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={t.project.colors[c]}
              title={t.project.colors[c]}
              className={`m-option p-${c} grid size-11 place-items-center`}
              onClick={() => setColor(c)}
            >
              <span className="size-6 rounded-full" style={{ background: "var(--pc)" }} />
            </button>
          ))}
        </div>
      </fieldset>
      {error && <p className="m-error" role="alert">{error}</p>}
      <button className="m-btn m-btn-primary w-full" disabled={busy || !name.trim()}>
        {busy ? t.common.saving : project ? t.common.save : t.project.create}
      </button>
    </form>
  );
}
