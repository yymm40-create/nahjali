"use client";

// «اربط بعادة»: the one way to tie something (my khatma, the reading time, the reading goals) to one of my habits. A
// single button; the choices open under it (in a sheet, or right there when it already sits inside one). Once tied, the
// habit's name shows with «غيّر» — and «فك الربط» is inside the choices, not a second button beside it.

import { useState } from "react";
import type { Habit } from "@/lib/mahdi/types";
import Icon from "./Icon";
import Sheet from "./Sheet";

export interface HabitLinkCreate {
  /** the button that makes a new habit for this and ties it, e.g. «أنشئ «ورد الختمة العلوية» واربطها» */
  label: string;
  hint?: string;
  /** more fields for the new habit (e.g. the project it goes in) */
  extra?: React.ReactNode;
  run: () => Promise<unknown>;
}

export default function HabitLinkButton({
  linked,
  habits,
  onChange,
  what,
  create,
  empty,
  busy = false,
  inline = false,
  label = "اربط بعادة",
}: {
  linked: Habit | null;
  habits: Habit[];
  onChange: (habitId: string | null) => unknown;
  /** what the tie does, in the person's words («كل دقيقة تقرؤها تنضاف لها») */
  what: string;
  create?: HabitLinkCreate;
  /** said when there is no habit to pick and nothing to make */
  empty?: string;
  busy?: boolean;
  /** open the choices right under the button (when it already sits inside a sheet) */
  inline?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const off = busy || working;

  const pick = async (id: string | null) => {
    setWorking(true);
    try {
      await onChange(id);
      setOpen(false);
    } finally {
      setWorking(false);
    }
  };

  const choices = (
    <div className="space-y-3">
      <p className="text-sm m-muted">{what}</p>
      {create && (
        <div className="m-soft space-y-2 p-3">
          {create.hint && <p className="m-num text-xs m-muted">{create.hint}</p>}
          {create.extra}
          <button
            type="button"
            className="m-btn m-btn-primary w-full"
            disabled={off}
            onClick={async () => {
              setWorking(true);
              try {
                await create.run();
                setOpen(false);
              } finally {
                setWorking(false);
              }
            }}
          >
            <Icon name="plus" size={18} /> {create.label}
          </button>
        </div>
      )}
      {habits.length > 0 ? (
        <div className="grid gap-2" role="radiogroup" aria-label="عاداتي">
          {habits.map((h) => (
            <button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={linked?.id === h.id}
              className="m-option flex min-h-12 items-center gap-3 px-3 text-start text-sm font-semibold"
              disabled={off}
              onClick={() => void pick(h.id)}
            >
              <span aria-hidden="true">{h.icon || "•"}</span>
              <span className="min-w-0 flex-1 truncate">{h.name}</span>
              {linked?.id === h.id && <Icon name="check" size={18} />}
            </button>
          ))}
        </div>
      ) : (
        !create && empty && <p className="text-sm m-muted">{empty}</p>
      )}
      {linked && (
        <button type="button" className="m-btn m-btn-quiet w-full" disabled={off} onClick={() => void pick(null)}>
          فك الربط
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      {linked ? (
        <div className="flex items-center gap-3">
          <Icon name="link" size={18} className="shrink-0 m-gold" />
          <span className="min-w-0 flex-1 text-sm">
            مربوطة بعادة <strong>«{linked.icon ? `${linked.icon} ` : ""}{linked.name}»</strong>
          </span>
          <button type="button" className="m-btn m-btn-quiet m-btn-sm" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            غيّر
          </button>
        </div>
      ) : (
        <button type="button" className="m-btn m-btn-ghost w-full" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <Icon name="link" size={18} /> {label}
        </button>
      )}
      {inline ? open && choices : (
        <Sheet open={open} onClose={() => setOpen(false)} title={label}>
          {choices}
        </Sheet>
      )}
    </div>
  );
}
