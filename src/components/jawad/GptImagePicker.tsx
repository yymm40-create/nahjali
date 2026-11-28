"use client";

// «نسخة GPT Image»: one row of three choices — GPT Image 2, or GPT Image 2.6 Sunburst / Flare — kept for the person's account
// (the film maker, the smart student…: every picture they paint follows it). Under it, when they have a running «لامحدود»
// pass, which version it makes free, so they stay unlimited.

import { useEffect, useState } from "react";
import { GPT_IMAGE_PICKS, type GptImagePick } from "@config/jawad/gpt-image";

type State = { pick: GptImagePick; unlimited: { two: boolean; twoSix: boolean } };

export default function GptImagePicker({ className = "" }: { className?: string }) {
  const [s, setS] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch("/api/jawad/gpt-image", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<State>) : null))
      .then((j) => live && j && setS(j))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!s) return null;

  async function choose(pick: GptImagePick) {
    if (!s || pick === s.pick || busy) return;
    const before = s.pick;
    setS({ ...s, pick });
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/jawad/gpt-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pick }) });
      if (!r.ok) throw new Error();
    } catch {
      setS((cur) => (cur ? { ...cur, pick: before } : cur));
      setError("ما انحفظ الاختيار؛ جرّب مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  const free = (p: GptImagePick) => (p === "2" ? s.unlimited.two : s.unlimited.twoSix);
  const any = s.unlimited.two || s.unlimited.twoSix;
  return (
    <div className={`space-y-1.5 ${className}`} dir="rtl">
      <p className="text-xs font-bold opacity-80">🖼️ نسخة GPT Image لصورك</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="نسخة GPT Image">
        {GPT_IMAGE_PICKS.map((o) => {
          const on = s.pick === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => choose(o.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${on ? "border-current bg-current/10" : "border-current/25 opacity-75 hover:opacity-100"}`}
            >
              <span dir="ltr">{o.label}</span>
              <span className="ms-1 font-normal opacity-75">· {o.hint}</span>
              {free(o.value) && <span className="ms-1">♾️</span>}
            </button>
          );
        })}
      </div>
      {any && (
        <p className="text-[11px] opacity-75">
          ♾️ اشتراكك «لامحدود» يشمل {s.unlimited.two && s.unlimited.twoSix ? "GPT Image 2 و2.6" : s.unlimited.two ? "GPT Image 2" : "GPT Image 2.6 (Sunburst وFlare)"}: اختره وتبقى صورك ضمن اشتراكك بدون خصم.
        </p>
      )}
      {error && <p className="text-[11px] text-red-500">{error}</p>}
    </div>
  );
}
