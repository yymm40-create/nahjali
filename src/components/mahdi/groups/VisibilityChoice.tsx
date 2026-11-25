"use client";

// «مين يشوف إنجاز الأعضاء؟»: the group's privacy choice, shown when a group is made and in its settings (the leader's).
// Disabled, with a note, until SQL 0129 is in the database (every group then stays open, as before).

import { t } from "@/lib/mahdi/i18n";
import type { GroupVisibility } from "@/lib/mahdi/groups/privacy";

const p = t.groups.privacy;

/** `disabled`: the choice is not available (with `note` saying why); `busy`: a save is under way. */
export default function VisibilityChoice({ value, onChange, disabled = false, busy = false, note }: { value: GroupVisibility; onChange: (v: GroupVisibility) => void; disabled?: boolean; busy?: boolean; note?: string }) {
  return (
    <fieldset className="space-y-2" disabled={disabled || busy}>
      <legend className="m-label">{p.title}</legend>
      <div className="grid gap-2" role="radiogroup" aria-label={p.title}>
        {(["all", "leaders"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            disabled={disabled || busy}
            className="m-option px-3 py-2 text-start disabled:opacity-60"
            onClick={() => onChange(v)}
          >
            <span className="block text-sm font-semibold">{v === "all" ? p.all : p.leaders}</span>
            <span className="block text-xs m-muted">{v === "all" ? p.allHint : p.leadersHint}</span>
          </button>
        ))}
      </div>
      {disabled && <p className="m-note text-sm">{note ?? p.notReady}</p>}
    </fieldset>
  );
}
