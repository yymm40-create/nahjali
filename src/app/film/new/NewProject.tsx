"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import ProjectFields, { type FieldValues } from "../ProjectFields";
import { useFilmBase } from "../FilmBase";

/** The first screen of a film: title + the user's own story. Saved as soon as it is created. */
export default function NewProject() {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [values, setValues] = useState<FieldValues>({ title: "", story: "", fixedFacts: "", targetDurationSec: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Arrived from «وش تبي تصنع اليوم؟» with an idea: it is the story, and its first words the title (both editable)
  useEffect(() => {
    const idea = new URLSearchParams(window.location.search).get("idea")?.trim();
    if (!idea) return;
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setValues((v) => (v.story || v.title ? v : { ...v, story: idea, title: idea.replace(/^فيلم\s*(عن|يحكي|يتكلم عن)?\s*/u, "").split(/[،,.؟!\n]/)[0].slice(0, 60).trim() || "فيلمي" })), 0);
    return () => clearTimeout(t);
  }, []);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>("/api/film/projects", values);
      router.push(`${filmBase}/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="display text-4xl">مشروع فيلم جديد</h1>
        <p className="font-bold text-muted">اكتب فكرتك بكلماتك ولو بأسطر قليلة. السيناريست بيبدأ منها، وما يغيّر قصتك بدون ما يسألك.</p>
      </header>
      <ProjectFields values={values} onChange={setValues} />
      {error && <p className="error-box">{error}</p>}
      <button className="btn btn-primary w-full text-xl" onClick={create} disabled={busy || !values.title.trim()}>
        {busy ? "نجهّز المشروع…" : "أنشئ المشروع"}
      </button>
    </div>
  );
}
