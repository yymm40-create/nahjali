"use client";

// «✏️ قطعة من مختبر الموشن» in a clip's settings: a film made in the lab keeps its scene, so its shown texts and main
// colours are edited right here («♻️ طبّق» renders it again in the background and swaps it in), or the whole piece
// goes back to the lab's conversation («💬 عدّل بالمحادثة»).

import { useEffect, useState } from "react";
import { postJson } from "@/lib/fetch";
import type { LabSource } from "./MotionLab";

export default function LabPiece({ projectId, assetId, disabled, onEdit }: { projectId: string; assetId: string; disabled?: boolean; onEdit: (assetId: string, source: LabSource, params: Record<string, string>, auto: boolean) => void }) {
  const [source, setSource] = useState<LabSource | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    postJson<{ source: LabSource | null }>(`/api/jawad/editor/projects/${projectId}`, { action: "lab_source_get", assetId })
      .then((r) => {
        if (!live) return;
        setSource(r.source);
        setValues(r.source?.params ?? {});
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [projectId, assetId]);
  if (failed) return null;
  const fields = source?.fields ?? [];
  const changed = Boolean(source) && JSON.stringify(values) !== JSON.stringify(source?.params ?? {});
  return (
    <div className="space-y-2 rounded-xl border border-jw-line p-2.5">
      <p className="text-xs font-semibold">🎬 قطعة من مختبر الموشن · قابلة للتعديل</p>
      {!source && <p className="text-[11px] text-jw-muted">أجيب مشهدها…</p>}
      {!!fields.length && (
        <div className="space-y-1.5">
          {fields.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 font-semibold">{f.label}</span>
              {f.type === "color" ? (
                <input type="color" className="h-8 w-12" disabled={disabled} value={/^#[0-9a-f]{6}$/i.test(values[f.id] ?? f.value) ? (values[f.id] ?? f.value) : "#000000"} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} />
              ) : (
                <input className="jw-input !min-h-8 flex-1 text-xs" disabled={disabled} value={values[f.id] ?? f.value} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} />
              )}
            </label>
          ))}
        </div>
      )}
      {source && !fields.length && <p className="text-[11px] leading-5 text-jw-muted">هذي القطعة انصنعت قبل خانات التعديل؛ عدّلها بالمحادثة.</p>}
      {source && (
        <div className="flex gap-2">
          {!!fields.length && (
            <button type="button" className="jw-btn jw-btn-primary !min-h-8 flex-1 text-xs" disabled={disabled || !changed} onClick={() => onEdit(assetId, source, values, true)} title="يرندرها من جديد بقيمك ويبدّلها في التايملاين">
              ♻️ طبّق
            </button>
          )}
          <button type="button" className="jw-btn !min-h-8 flex-1 text-xs" disabled={disabled} onClick={() => onEdit(assetId, source, values, false)}>
            💬 عدّل بالمحادثة
          </button>
        </div>
      )}
    </div>
  );
}
