"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import ProjectFields, { type FieldValues } from "../ProjectFields";
import { useFilmBase } from "../FilmBase";
import ResearchChoice from "../ResearchChoice";
import StepWhy from "../StepWhy";
import "../stage/stage.css";

/** The first screen of a scene: title + the user's own story. Saved as soon as it is created. */
export default function NewProject() {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [values, setValues] = useState<FieldValues>({ title: "", story: "", fixedFacts: "", targetDurationSec: "" });
  const [research, setResearch] = useState<"yes" | "no" | "">("");
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
      const { id } = await postJson<{ id: string }>("/api/film/projects", { ...values, research });
      // straight to the screenwriter, who starts by himself; «نعم»: سجاد opens there too and asks for the research's scope
      router.push(`${filmBase}/${id}/script?start=1${research === "yes" ? "&research=1" : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fs">
      <div className="fs-room" aria-hidden><div className="beam" /><div className="dust" /><div className="grain" /></div>
      <div className="mx-auto max-w-2xl space-y-5 px-3 pb-20">
        <header className="fs-hero">
          <p className="fs-kicker">مشهد جديد</p>
          <h1>ابدأ من فكرتك</h1>
          <p>اكتبها بكلماتك ولو بأسطر قليلة. السيناريست بيبدأ منها، وما يغيّر قصتك بدون ما يسألك.</p>
        </header>
        <StepWhy step="new" sajjad={false} />
        <ProjectFields values={values} onChange={setValues} />
        <ResearchChoice value={research} onChange={setResearch} />
        {error && <p className="error-box">{error}</p>}
        {!research && values.title.trim() && <p className="text-center text-sm font-bold text-muted">اختر أول: تبيني أبحث لتطوير القصة أو لا؟</p>}
        <button className="btn btn-primary w-full text-xl" onClick={create} disabled={busy || !values.title.trim() || !research}>
          {busy ? "نجهّز المشهد…" : "🎬 ابدأ المشهد"}
        </button>
      </div>
    </div>
  );
}
