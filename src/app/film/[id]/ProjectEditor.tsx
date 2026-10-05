"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/fetch";
import ProjectFields, { type FieldValues } from "../ProjectFields";

type SaveState = "saved" | "dirty" | "saving" | "error";

/** Edits the project fields and saves them automatically a moment after the user stops typing. */
export default function ProjectEditor({ projectId, initial, locked }: { projectId: string; initial: FieldValues; locked?: boolean }) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const saved = useRef(initial);

  useEffect(() => {
    const changed = (Object.keys(values) as (keyof FieldValues)[]).filter((k) => values[k] !== saved.current[k]);
    if (changed.length === 0) return;
    // A blank title is not saved; the user is probably still typing
    if (!values.title.trim()) return;
    const timer = setTimeout(async () => {
      setState("saving");
      try {
        await api(`/api/film/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.fromEntries(changed.map((k) => [k, values[k]]))),
        });
        saved.current = values;
        setState("saved");
        setError("");
      } catch (e) {
        setState("error");
        setError((e as Error).message);
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [values, projectId]);

  // Leaving the page within a moment of typing (e.g. straight to «ابدأ مع السيناريست»): the last words are still saved
  const latest = useRef(values);
  useEffect(() => {
    latest.current = values;
  });
  useEffect(
    () => () => {
      const v = latest.current;
      const changed = (Object.keys(v) as (keyof FieldValues)[]).filter((k) => v[k] !== saved.current[k]);
      if (!changed.length || !v.title.trim()) return;
      fetch(`/api/film/projects/${projectId}`, {
        method: "PATCH",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(changed.map((k) => [k, v[k]]))),
      }).catch(() => {});
    },
    [projectId],
  );

  // Warn before leaving with unsaved text
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (state !== "saved") e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [state]);

  const label = { saved: "✅ محفوظ", dirty: "✏️ تعديل غير محفوظ", saving: "⏳ نحفظ…", error: "⚠️ ما انحفظ" }[state];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="display text-2xl">قصتك</h2>
        <span className="text-sm font-extrabold text-muted" role="status">{label}</span>
      </div>
      {locked && (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm font-bold text-muted">
          السيناريست بدأ يشتغل على هذي القصة، فصارت للقراءة. أي تعديل عليها اطلبه من صفحة السيناريست.
        </p>
      )}
      <ProjectFields
        disabled={locked}
        values={values}
        onChange={(v) => {
          setValues(v);
          const same = (Object.keys(v) as (keyof FieldValues)[]).every((k) => v[k] === saved.current[k]);
          setState(same ? "saved" : "dirty");
        }}
      />
      {error && <p className="error-box">{error}</p>}
    </section>
  );
}
