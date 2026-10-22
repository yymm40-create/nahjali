"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { FILM_KINDS, type FilmKind } from "@config/film";
import ProjectFields, { type FieldValues } from "../ProjectFields";
import { useFilmBase } from "../FilmBase";
import ResearchChoice from "../ResearchChoice";
import StepWhy from "../StepWhy";
import "../stage/stage.css";
import JourneyIntakeCard from "../JourneyIntakeCard";
import type { JourneyIntake } from "@/lib/film/intake";

/** The first screen of a scene: title + the user's own story. Saved as soon as it is created. */
export default function NewProject() {
  const router = useRouter();
  const filmBase = useFilmBase();
  const [values, setValues] = useState<FieldValues>({ title: "", story: "", fixedFacts: "", targetDurationSec: "" });
  // WHAT is being made: a short scene that stands on its own, a whole cinematic film, or a series (its own place)
  const [kind, setKind] = useState<FilmKind | "">("");
  const [research, setResearch] = useState<"yes" | "no" | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intake, setIntake] = useState<JourneyIntake | null>(null);
  const draftId = useRef(crypto.randomUUID());

  // Arrived from «وش تبي تصنع اليوم؟» with an idea: it is the story, and its first words the title (both editable)
  useEffect(() => {
    const idea = new URLSearchParams(window.location.search).get("idea")?.trim();
    if (!idea) return;
    window.history.replaceState(null, "", window.location.pathname);
    const t = setTimeout(() => setValues((v) => (v.story || v.title ? v : { ...v, story: idea, title: idea.replace(/^فيلم\s*(عن|يحكي|يتكلم عن)?\s*/u, "").split(/[،,.؟!\n]/)[0].slice(0, 60).trim() || "فيلمي" })), 0);
    return () => clearTimeout(t);
  }, []);

  async function understand(answers: Record<string, string> = {}) {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ intake: JourneyIntake }>("/api/film/intake", { draftId: draftId.current, kind, title: values.title, story: values.story, fixedFacts: values.fixedFacts, targetDurationSec: values.targetDurationSec, answers, previous: intake });
      setIntake(result.intake);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!intake) return void understand();
    setBusy(true);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>("/api/film/projects", { ...values, title: intake.title || values.title, story: intake.concept || values.story, targetDurationSec: intake.targetDurationSec ?? values.targetDurationSec, fixedFacts: intake.fixedFacts.join("\n") || values.fixedFacts, research, kind, intake, workflowVersion: 2 });
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
          <p className="fs-kicker">{kind === "film" ? "فيلم جديد" : "عمل جديد"}</p>
          <h1>ابدأ من فكرتك</h1>
          <p>اكتبها بكلماتك ولو بأسطر قليلة. السيناريست بيبدأ منها، وما يغيّر قصتك بدون ما يسألك.</p>
        </header>
        <StepWhy step="new" sajjad={false} />

        {/* FIRST: what is being made — a scene, a film, or a series (which has its own place) */}
        {!intake && <section className="card space-y-2 p-3">
          <b className="block text-base">وش تبي تصنع؟</b>
          <div className="grid gap-2 sm:grid-cols-3">
            {FILM_KINDS.map((k) =>
              k.id === "series" ? (
                <Link key={k.id} href={`${filmBase}/series`} className="kind-card">
                  <span className="kind-icon" aria-hidden>{k.icon}</span>
                  <b>{k.ar}</b>
                  <small>{k.hint}</small>
                </Link>
              ) : (
                <button key={k.id} type="button" className={`kind-card${kind === k.id ? " on" : ""}`} aria-pressed={kind === k.id} onClick={() => { setKind(k.id); setIntake(null); }}>
                  <span className="kind-icon" aria-hidden>{k.icon}</span>
                  <b>{k.ar}</b>
                  <small>{k.hint}</small>
                </button>
              ),
            )}
          </div>
          {kind === "film" && <p className="text-xs leading-6 text-muted">الفيلم يُكتب كعمل كامل: بداية وتحوّل ونهاية، ومشاهد مرقّمة لكل واحد مكانه وهدفه — وكل مشهد تصنعه بعدها بنفس الأدوات (صور، فيديو، أصوات، موسيقى).</p>}
          {kind === "scene" && <p className="text-xs leading-6 text-muted">المشهد القصير يقف بنفسه: مكان واحد ولحظة واحدة — أسرع وأرخص، وما يفتح أحداثًا تحتاج مشاهد ثانية.</p>}
        </section>}

        {!intake && <ProjectFields kind={kind} values={values} onChange={(next) => { setValues(next); setIntake(null); }} />}
        <ResearchChoice value={research} onChange={setResearch} />
        {error && <p className="error-box">{error}</p>}
        {intake ? (
          <JourneyIntakeCard intake={intake} busy={busy} onRecheck={(answers) => void understand(answers)} onConfirm={() => void create()} onEdit={() => setIntake(null)} />
        ) : (
          <>
            {!kind && <p className="text-center text-sm font-bold text-muted">اختر أول: مشهد قصير أو فيلم سينمائي؟</p>}
            {kind && !research && values.title.trim() && <p className="text-center text-sm font-bold text-muted">اختر: تبيني أبحث لتطوير القصة أو لا؟</p>}
            <button className="btn btn-primary w-full text-xl" onClick={() => void understand()} disabled={busy || !values.title.trim() || values.story.trim().length < 10 || !research || !kind}>
              {busy ? "سجاد يراجع الفكرة…" : <><span aria-hidden>🤖</span> خل سجاد يفهمها ويسأل الناقص</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
