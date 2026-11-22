"use client";

// «اختر رحلتك» (config/film-journey.ts): the mind that writes this film's texts — «الرحلة المخلّطة» (each task with the mind
// that suits it, «منصوح به»), «رحلة الأصيل» or «رحلة الخفيف». Chosen when the film is made and changeable from its pages.

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import Coined from "@/components/Coined";
import { usePerks } from "@/components/usePerks";
import { postJson } from "@/lib/fetch";
import { CLAUDE_MODELS, typicalReplyUsd } from "@config/claude-models";
import { claudeHalalas, coinStr, costHalalas } from "@config/coins";
import { filmJourneyOf, journeysUpTo, type FilmJourney } from "@config/film-journey";
import "./stage/stage.css";

/** The open project's journey for the pages under it (null: a project made before the journeys, or none chosen). */
const JourneyContext = createContext<FilmJourney | null>(null);
export const useFilmJourney = () => useContext(JourneyContext);
export const JourneyProvider = ({ journey, children }: { journey: FilmJourney | null; children: React.ReactNode }) => <JourneyContext.Provider value={journey}>{children}</JourneyContext.Provider>;

/** The three journeys as cards; the chosen one's advice under them. */
export default function JourneyPicker({ value, onChange, disabled = false }: { value: FilmJourney | null; onChange: (j: FilmJourney) => void; disabled?: boolean }) {
  const perks = usePerks();
  const price = (key: "opus" | "haiku") => {
    const usd = typicalReplyUsd(CLAUDE_MODELS.find((m) => m.key === key)!);
    return coinStr(perks.atCost ? costHalalas(usd) : claudeHalalas(usd));
  };
  const picked = filmJourneyOf(value);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="اختر رحلتك">
        {journeysUpTo(perks.claudeModel).map((j) => (
          <button key={j.key} type="button" role="radio" aria-checked={value === j.key} disabled={disabled} className={`kind-card${value === j.key ? " on" : ""}`} onClick={() => onChange(j.key)}>
            <span className="kind-icon" aria-hidden>{j.icon}</span>
            <b>
              {j.name}
              {j.recommended && <span className="ms-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 align-middle text-[10.5px] font-extrabold text-white">منصوح به</span>}
            </b>
            <small>{j.tagline}</small>
            <small>
              {j.key === "mixed" ? "السعر بين الاثنين" : <Coined text={`≈ ${price(j.key)} للرد`} size={11} />}
            </small>
          </button>
        ))}
      </div>
      {picked && <p className="text-xs leading-6 text-muted">💡 {picked.advice}</p>}
    </div>
  );
}

/** On a project's pages: the journey in one line, and a tap to change it (the project's owner). */
export function JourneyBar({ projectId, journey, canChange }: { projectId: string; journey: FilmJourney | null; canChange: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const def = filmJourneyOf(journey);
  // a project made before the journeys, opened by someone who cannot choose for it: nothing to show
  if (!def && !canChange) return null;
  const choose = async (j: FilmJourney) => {
    if (j === journey) return setOpen(false);
    setBusy(true);
    setError("");
    try {
      await postJson(`/api/film/projects/${projectId}/journey`, { journey: j });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <button type="button" className="chip text-xs" aria-expanded={open} disabled={!canChange} onClick={() => setOpen((o) => !o)}>
        {def ? `${def.icon} ${def.name}${def.recommended ? " · منصوح به" : ""}` : "🧭 اختر رحلتك (أي عقل يكتب فيلمك)"}
        {canChange && (open ? " ▴" : " ▾")}
      </button>
      {open && (
        <div className="card space-y-2 p-3">
          <b className="block text-sm">اختر رحلتك</b>
          <p className="text-xs leading-6 text-muted">التغيير يمشي على الردود الجاية بس؛ اللي انكتب قبل يبقى مثل ما هو.</p>
          <JourneyPicker value={journey} onChange={(j) => void choose(j)} disabled={busy} />
          {error && <p className="error-box">{error}</p>}
        </div>
      )}
    </div>
  );
}
