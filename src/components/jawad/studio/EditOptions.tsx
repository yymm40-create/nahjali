"use client";

import type { GeneratorDef, Settings, SettingValue } from "@config/jawad/types";
import { evaluate, priceTable } from "@/lib/jawad/engine";
import { EDIT_OPTION_KEYS, type EditMode } from "@/lib/jawad/smart-edit";
import OutputSettings from "./OutputSettings";

/**
 * «التعديل الذكي» — the options of the edit, the same ones the generation had at the start: the generator that will make
 * it, and the output options (a video's resolution, sound and — for the whole clip — its seconds; an image's resolution
 * and quality). Whatever is chosen here is counted in the price and goes to جواد with the person's words and the shot.
 * Shared by the studio's dialog and the editor's red pieces.
 */
export default function EditOptions({
  def,
  choices,
  originalId,
  onGenerator,
  original,
  chosen,
  onChange,
  mode,
  cutSeconds,
  disabled,
}: {
  /** the generator that will make the edit */
  def: GeneratorDef;
  /** the generators of the same kind that can make an edit */
  choices: GeneratorDef[];
  /** the generator the original was made with */
  originalId: string;
  onGenerator: (id: string) => void;
  /** the original's settings (what each option starts from) */
  original: Settings;
  /** what the person chose for this edit (only the keys they touched) */
  chosen: Settings;
  onChange: (key: string, v: SettingValue) => void;
  /** the kind of edit: the seconds of a whole clip can be chosen; a part's are the cut's */
  mode: EditMode;
  cutSeconds?: number | null;
  disabled?: boolean;
}) {
  const kind = def.output === "image" ? "image" : "video";
  // the options as this generator offers them (its own allowed values, ranges and defaults), starting from the original's
  const ev = evaluate(def, { settings: { ...original, ...chosen }, prompt: "x", instructions: "", refStyle: "none", refs: [], strict: false }, priceTable(def, undefined));
  const keys = EDIT_OPTION_KEYS[kind].filter((k) => k !== "duration" || mode === "whole");
  const shown = ev.options.filter((o) => keys.includes(o.key) && !o.hidden);
  return (
    <fieldset className="space-y-3 rounded-xl border border-jw-line bg-jw-bg-2 p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">خيارات التعديل</legend>
      {choices.length > 1 && (
        <label className="block space-y-1">
          <span className="jw-label">المولّد</span>
          <select className="jw-select" value={def.id} onChange={(e) => onGenerator(e.target.value)} aria-label="المولّد الذي يصنع التعديل">
            {choices.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.id === originalId ? " (نفس مولد الأصل)" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <OutputSettings ev={{ ...ev, options: shown, notes: [] }} values={ev.settings} onChange={onChange} />
      {mode === "parts" && kind === "video" && (
        <p className="text-xs text-jw-muted">
          الثواني: {cutSeconds ? <b className="tabular-nums" dir="ltr">{cutSeconds}</b> : "تُحسب من الجزء الذي تحدده"}
          {cutSeconds ? " ث" : ""} — طول القطعة المعادة هو طول الجزء المعلّم (لا أقل من أقصر مدة يولّدها المولّد).
        </p>
      )}
      <p className="text-[11px] text-jw-faint">كل خيار هنا يدخل في السعر، ويصل مع كلامك ومعلومات اللقطة إلى جواد؛ هو من يقرر البرومبت ويولّد.</p>
    </fieldset>
  );
}
