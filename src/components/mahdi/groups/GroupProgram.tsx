"use client";

// «البرنامج» of a group: its projects and habits, built by its leaders with the very same forms (and the same options)
// as a person's own, each member logging them in their own day. The leaders (and admins with «البرنامج») add, edit,
// pause, archive and delete; the others see what the group asks of them.

import { useState } from "react";
import { describeGoal, habitStatus, currentVersion } from "@/lib/mahdi/client/derive";
import { mahdiFetch } from "@/lib/mahdi/client/fetch";
import { t } from "@/lib/mahdi/i18n";
import type { Habit, Project } from "@/lib/mahdi/types";
import ConfirmSheet from "../ConfirmSheet";
import HabitForm, { type FormTarget } from "../HabitForm";
import Icon from "../Icon";
import ProjectForm from "../ProjectForm";
import { useMahdi } from "../Provider";

export interface ProgramData {
  ready: boolean;
  projects: Project[];
  habits: Habit[];
}

const p = t.groups.program;
type Ask = { kind: "project"; project: Project } | { kind: "habit"; habit: Habit } | null;

export default function GroupProgram({ groupId, program, canEdit, onChanged }: { groupId: string; program: ProgramData; canEdit: boolean; onChanged: () => void }) {
  const { state, store, toast } = useMahdi();
  const { today } = state;
  const weekStart = state.snap.profile.weekStart;
  const [projectForm, setProjectForm] = useState<{ project?: Project } | null>(null);
  const [habitForm, setHabitForm] = useState<{ habit?: Habit; projectId?: string } | null>(null);
  const [ask, setAsk] = useState<Ask>(null);
  const [showArchived, setShowArchived] = useState(false);

  const post = async <T,>(json: object) => mahdiFetch<T>(`/api/mahdi/groups/${groupId}`, { method: "POST", json });
  // after any change: this page, and my own day (the group's habits show there)
  const changed = () => {
    onChanged();
    store.refresh();
  };
  const run = async (json: object, done: string) => {
    try {
      await post(json);
      toast(done);
      changed();
    } catch (e) {
      toast((e as Error).message);
    }
  };

  const projectTarget: FormTarget = {
    projects: program.projects,
    save: async (body, id) => {
      const r = await post<{ id: string }>({ action: "project_save", ...body, ...(id ? { projectId: id } : {}) });
      changed();
      return r.id;
    },
  };
  const habitTarget: FormTarget = {
    projects: program.projects,
    save: async (body, id) => {
      const r = await post<{ id: string }>({ action: "habit_save", ...body, ...(id ? { habitId: id } : {}) });
      changed();
      return r.id;
    },
  };

  if (!program.ready) return <p className="m-note">{p.notReady}</p>;
  const live = program.projects.filter((x) => !x.archivedAt);
  const archived = program.projects.filter((x) => x.archivedAt);

  const projectCard = (project: Project) => {
    const habits = program.habits.filter((h) => h.projectId === project.id);
    const isArchived = Boolean(project.archivedAt);
    return (
      <section key={project.id} className={`m-card p-${project.color} space-y-2 px-4 py-3 ${isArchived ? "opacity-70" : ""}`} aria-labelledby={`gp-${project.id}`}>
        <div className="flex items-center gap-2">
          <span className="m-dot" style={{ background: "var(--pc)" }} />
          <h3 id={`gp-${project.id}`} className="flex-1 truncate font-semibold">
            {project.icon && <span aria-hidden="true">{project.icon} </span>}
            {project.name}
            {isArchived && <span className="m-chip ms-2 text-xs">{p.archived}</span>}
          </h3>
          {canEdit && !isArchived && (
            <>
              <button type="button" className="m-icon-btn" aria-label={`${p.addHabit}: ${project.name}`} onClick={() => setHabitForm({ projectId: project.id })}>
                <Icon name="plus" size={20} />
              </button>
              <button type="button" className="m-icon-btn" aria-label={`${p.editProject}: ${project.name}`} onClick={() => setProjectForm({ project })}>
                <Icon name="edit" size={18} />
              </button>
            </>
          )}
        </div>
        {habits.length === 0 ? (
          <p className="text-sm m-muted">{p.noHabits}</p>
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--m-line)" }}>
            {habits.map((h) => {
              const status = habitStatus(h, today);
              const v = currentVersion(h, today);
              return (
                <li key={h.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="min-w-0 flex-1">
                    <span className={`block font-semibold ${status === "archived" ? "line-through m-muted" : ""}`}>
                      {h.icon && <span aria-hidden="true">{h.icon} </span>}
                      {h.name}
                    </span>
                    <span className="flex flex-wrap gap-x-2 text-xs m-muted">
                      {v && <span>{describeGoal(v, weekStart)}</span>}
                      {status === "paused" && <span className="m-chip text-[11px]">{p.paused}</span>}
                      {status === "archived" && <span className="m-chip text-[11px]">{p.archived}</span>}
                      {h.category && <span>· {h.category}</span>}
                    </span>
                  </span>
                  {canEdit && !isArchived && (
                    <span className="flex flex-wrap gap-1">
                      <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setHabitForm({ habit: h })}>{p.editHabit}</button>
                      {status === "active" && <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => run({ action: "habit_save", habitId: h.id, state: "paused" }, p.saved)}>{p.pause}</button>}
                      {(status === "paused" || status === "archived") && <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => run({ action: "habit_save", habitId: h.id, state: "active" }, p.saved)}>{p.resume}</button>}
                      {status !== "archived" && <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => run({ action: "habit_save", habitId: h.id, state: "archived" }, p.saved)}>{p.archiveHabit}</button>}
                      <button type="button" className="m-icon-btn m-btn-ghost" aria-label={`${p.deleteHabit}: ${h.name}`} onClick={() => setAsk({ kind: "habit", habit: h })}>
                        <Icon name="trash" size={16} />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2 pt-1">
            {isArchived ? (
              <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => run({ action: "project_archive", projectId: project.id, archived: false }, p.saved)}>{p.restoreProject}</button>
            ) : (
              <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => run({ action: "project_archive", projectId: project.id, archived: true }, p.saved)}>{p.archiveProject}</button>
            )}
            <button type="button" className="m-btn m-btn-quiet m-btn-sm" onClick={() => setAsk({ kind: "project", project })}>{p.deleteProject}</button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h2 className="text-lg font-semibold">{p.title}</h2>
        <p className="text-sm m-muted">{canEdit ? p.hint : p.memberHint}</p>
      </header>

      {live.length === 0 && <p className="m-card p-5 text-center m-muted">{canEdit ? p.emptyLeader : p.empty}</p>}
      {live.map(projectCard)}

      {canEdit && (
        <button type="button" className="m-btn m-btn-primary w-full" onClick={() => setProjectForm({})}>
          <Icon name="plus" /> {p.addProject}
        </button>
      )}

      {canEdit && archived.length > 0 && (
        <div className="space-y-3">
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}>
            <Icon name={showArchived ? "chevronUp" : "chevronDown"} size={16} /> {p.archived} ({archived.length})
          </button>
          {showArchived && archived.map(projectCard)}
        </div>
      )}

      <ProjectForm open={Boolean(projectForm)} onClose={() => setProjectForm(null)} project={projectForm?.project} target={projectTarget} />
      <HabitForm open={Boolean(habitForm)} onClose={() => setHabitForm(null)} habit={habitForm?.habit} projectId={habitForm?.projectId} target={habitTarget} />
      <ConfirmSheet
        open={Boolean(ask)}
        onClose={() => setAsk(null)}
        title={ask?.kind === "project" ? `${p.deleteProject}: ${ask.project.name}` : ask?.kind === "habit" ? `${p.deleteHabit}: ${ask.habit.name}` : ""}
        body={ask?.kind === "project" ? p.deleteProjectBody : p.deleteHabitBody}
        onConfirm={async () => {
          const a = ask;
          if (!a) return;
          await post(a.kind === "project" ? { action: "project_delete", projectId: a.project.id } : { action: "habit_delete", habitId: a.habit.id });
          toast(p.deleted);
          changed();
        }}
      />
    </div>
  );
}
