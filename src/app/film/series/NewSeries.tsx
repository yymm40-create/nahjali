"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { postJson } from "@/lib/fetch";
import { useFilmBase } from "../FilmBase";
import ResearchChoice from "../ResearchChoice";
import StepWhy from "../StepWhy";
import JourneyIntakeCard from "../JourneyIntakeCard";
import type { JourneyIntake } from "@/lib/film/intake";

/** The gold card that opens into a short form: the series' name, what it is about, alone or with a team. */
export default function NewSeries() {
  const router = useRouter();
  const base = useFilmBase();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [research, setResearch] = useState<"yes" | "no" | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [intake, setIntake] = useState<JourneyIntake | null>(null);
  const draftId = useRef(crypto.randomUUID());

  const understand = async (answers: Record<string, string> = {}) => {
    setBusy(true);
    setError("");
    try {
      const result = await postJson<{ intake: JourneyIntake }>("/api/film/intake", { draftId: draftId.current, kind: "series", title, story: about, answers, previous: intake });
      setIntake(result.intake);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!intake) return void understand();
    setBusy(true);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>("/api/film/series", { title: intake.title || title, about: intake.concept || about, mode, research, intake, workflowVersion: 2 });
      // «نعم»: سجاد opens on the series' page and asks for the scope
      router.push(`${base}/series/${id}${research === "yes" ? "?research=1" : ""}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="film-option text-start" data-tone="gold" onClick={() => setOpen(true)}>
        <span className="film-option-icon" aria-hidden>📺</span>
        <span className="film-option-step">جديد</span>
        <h3>ابدأ مسلسل ✨</h3>
        <p>سمّه واكتب عنه بسطرين، وأول حلقة تجهز لك.</p>
      </button>
    );
  }
  return (
    <div className="film-option space-y-2" data-tone="light" style={{ justifyContent: "flex-start", width: "min(86vw, 360px)" }}>
      <h3>مسلسل جديد</h3>
      <StepWhy step="newSeries" sajjad={false} />
      {!intake && <input className="field" placeholder="اسم المسلسل" maxLength={80} value={title} onChange={(e) => { setTitle(e.target.value); setIntake(null); }} autoFocus />}
      {!intake && <textarea className="field min-h-24 text-sm" placeholder="عن وش المسلسل؟ عالمه وشخصياته الأساسية (يروح مع كل مشهد للسيناريست)" maxLength={4000} value={about} onChange={(e) => { setAbout(e.target.value); setIntake(null); }} />}
      <div className="grid grid-cols-2 gap-2">
        {(["solo", "team"] as const).map((m) => (
          <button key={m} type="button" className={`btn min-h-11 text-sm ${mode === m ? "btn-secondary" : "btn-ghost"}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "solo" ? "👤 فردي" : "👥 فريق"}
          </button>
        ))}
      </div>
      <ResearchChoice value={research} onChange={setResearch} compact />
      {error && <p className="error-box text-sm">{error}</p>}
      {intake ? <JourneyIntakeCard intake={intake} busy={busy} onRecheck={(answers) => void understand(answers)} onConfirm={() => void create()} onEdit={() => setIntake(null)} /> : (
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary min-h-11 flex-1" disabled={busy || !title.trim() || about.trim().length < 10 || !research} onClick={() => void understand()}>{busy ? "سجاد يراجع…" : "خل سجاد يفهم المسلسل"}</button>
          <button type="button" className="btn btn-ghost min-h-11" onClick={() => setOpen(false)}>إلغاء</button>
        </div>
      )}
    </div>
  );
}
