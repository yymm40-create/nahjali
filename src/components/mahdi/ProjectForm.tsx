"use client";

import { useState } from "react";
import { MAHDI_LIMITS, PROJECT_COLORS, PROJECT_SUGGESTIONS, type ProjectColor } from "@config/mahdi";
import { t } from "@/lib/mahdi/i18n";
import type { Project } from "@/lib/mahdi/types";
import type { FormTarget } from "./HabitForm";
import GoalForm from "./goals/GoalForm";
import Icon from "./Icon";
import IconPicker from "./IconPicker";
import { useMahdi } from "./Provider";
import Sheet from "./Sheet";

/**
 * Create or edit a project (name, icon, colour): the person's own, or a group's (`target`, see HabitForm). A new one of
 * the person's own starts with a choice: an ordinary project, or a strategic goal («هدف استراتيجي», see goals/GoalForm).
 */
export default function ProjectForm({
  open,
  onClose,
  project,
  onSaved,
  target,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
  onSaved?: (id: string) => void;
  target?: FormTarget;
}) {
  const [kind, setKind] = useState<"project" | "goal" | null>(null);
  const close = () => {
    setKind(null);
    onClose();
  };
  const chosen = project ? (project.kind === "goal" && project.goal ? "goal" : "project") : target ? "project" : kind;
  const title = project ? (chosen === "goal" ? t.goal.editTitle : t.project.editTitle) : chosen === "goal" ? t.goal.newTitle : chosen ? t.project.newTitle : t.goal.kindTitle;
  return (
    <Sheet open={open} onClose={close} title={title} wide={chosen === "goal"}>
      {open && !chosen && (
        <div className="grid gap-3" role="radiogroup" aria-label={t.goal.kindTitle}>
          {(["project", "goal"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={false} className="m-option flex items-center gap-3 p-4 text-start" onClick={() => setKind(k)}>
              <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: "var(--m-surface-2)" }}>
                <Icon name={k === "goal" ? "target" : "projects"} />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-semibold">{t.goal.kinds[k].label}</span>
                <span className="m-hint block">{t.goal.kinds[k].hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {open && chosen === "goal" && <GoalForm project={project} onClose={close} onSaved={onSaved} />}
      {open && chosen === "project" && <Form project={project} onClose={close} onSaved={onSaved} target={target} />}
    </Sheet>
  );
}

function Form({ project, onClose, onSaved, target }: { project?: Project; onClose: () => void; onSaved?: (id: string) => void; target?: FormTarget }) {
  const { store, state, toast } = useMahdi();
  const existing = target?.projects ?? state.snap.projects;
  const [name, setName] = useState(project?.name ?? "");
  const [icon, setIcon] = useState(project?.icon ?? "");
  const [color, setColor] = useState<ProjectColor>(project?.color ?? PROJECT_COLORS[existing.length % PROJECT_COLORS.length]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const taken = new Set(existing.map((p) => p.name));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    try {
      const body = { name: name.trim(), icon, color };
      if (target) {
        const id = await target.save(body, project?.id);
        toast(t.common.saved);
        onSaved?.(id);
      } else if (project) {
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
