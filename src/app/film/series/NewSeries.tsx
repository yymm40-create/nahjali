"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { postJson } from "@/lib/fetch";
import { useFilmBase } from "../FilmBase";

/** The gold card that opens into a short form: the series' name, what it is about, alone or with a team. */
export default function NewSeries() {
  const router = useRouter();
  const base = useFilmBase();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [mode, setMode] = useState<"solo" | "team">("solo");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const { id } = await postJson<{ id: string }>("/api/film/series", { title, about, mode });
      router.push(`${base}/series/${id}`);
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
      <input className="field" placeholder="اسم المسلسل" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea className="field min-h-24 text-sm" placeholder="عن وش المسلسل؟ عالمه وشخصياته الأساسية (يروح مع كل مشهد للسيناريست)" maxLength={4000} value={about} onChange={(e) => setAbout(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        {(["solo", "team"] as const).map((m) => (
          <button key={m} type="button" className={`btn min-h-11 text-sm ${mode === m ? "btn-secondary" : "btn-ghost"}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === "solo" ? "👤 فردي" : "👥 فريق"}
          </button>
        ))}
      </div>
      {error && <p className="error-box text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary min-h-11 flex-1" disabled={busy || !title.trim()} onClick={create}>{busy ? "نجهّز…" : "أنشئ المسلسل"}</button>
        <button type="button" className="btn btn-ghost min-h-11" onClick={() => setOpen(false)}>إلغاء</button>
      </div>
    </div>
  );
}
