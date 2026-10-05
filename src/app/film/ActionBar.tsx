"use client";

import { createContext, useContext, useState } from "react";

export type SendMode = "edit" | "direct";

/** Edits the user has left in this stage (the owner's limits, /admin/limits); null = no limit. */
export const EditsLeftContext = createContext<number | null>(null);

/**
 * The same actions at every film step: approval on one side; on the other, an edit of this deliverable
 * or a new direction/command. Edits stay possible after approval, with a warning about what they affect.
 */
export default function ActionBar({
  busy,
  onApprove,
  approveLabel = "اعتمد ✅",
  onSend,
  warning,
}: {
  busy: boolean;
  onApprove?: () => void;
  approveLabel?: string;
  onSend?: (mode: SendMode, text: string) => void;
  /** Shown before an edit is sent, e.g. what an already-approved step will affect. */
  warning?: string;
}) {
  const [mode, setMode] = useState<SendMode | null>(null);
  const [text, setText] = useState("");
  const left = useContext(EditsLeftContext);
  const editable = Boolean(onSend);
  const send = left === 0 ? undefined : onSend;
  if (busy || (!onApprove && !editable)) return null;
  const toggle = (m: SendMode) => setMode(mode === m ? null : m);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {onApprove && (
          <button className="btn btn-primary flex-1" onClick={onApprove}>{approveLabel}</button>
        )}
        {send && (
          <div className="flex flex-1 gap-2">
            <button className={`btn flex-1 px-2 ${mode === "edit" ? "btn-secondary" : "btn-ghost"}`} onClick={() => toggle("edit")}>تعديل ✏️</button>
            <button className={`btn flex-1 px-2 ${mode === "direct" ? "btn-secondary" : "btn-ghost"}`} onClick={() => toggle("direct")}>توجيه أو أمر جديد 🧭</button>
          </div>
        )}
      </div>
      {onApprove && send && <p className="text-center text-xs font-bold text-muted">💡 عجبك؟ اضغط «اعتمد». تبي تغيّر شي؟ اضغط «تعديل».</p>}
      {!editable ? null : left === 0 ? (
        <p className="text-center text-xs font-bold text-muted">خلصت التعديلات المتاحة لك في هذي المرحلة.</p>
      ) : left !== null && send ? (
        <p className="text-center text-xs font-bold text-muted">باقي لك {left} {left === 1 ? "تعديل" : "تعديلات"} في هذي المرحلة، فاكتب كل اللي تبيه مرة وحدة.</p>
      ) : null}
      {mode && send && (
        <div className="space-y-2">
          {warning && <p className="rounded-2xl border-s-4 border-gold bg-gold/10 p-3 text-sm font-bold">⚠️ {warning}</p>}
          <textarea
            className="field min-h-24"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 4000))}
            placeholder={mode === "edit" ? "اكتب وش تبي يتغيّر في هذا الجزء" : "اكتب توجيهك أو أمرك الجديد"}
          />
          <button
            className="btn btn-secondary w-full"
            disabled={!text.trim()}
            onClick={() => { send(mode, text); setMode(null); setText(""); }}
          >
            {mode === "edit" ? "أرسل التعديل" : "أرسل التوجيه"}
          </button>
        </div>
      )}
    </div>
  );
}
