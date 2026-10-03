"use client";

import { useMahdi } from "./Provider";

/** Short confirmations ("سُجّل …") with an optional "تراجع". Announced politely to screen readers. */
export default function Toasts() {
  const { toasts, dismiss } = useMahdi();
  return (
    <div className="m-toasts" role="status" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className="m-toast">
          <span className="flex-1">{x.message}</span>
          {x.action && (
            <button
              type="button"
              className="m-btn m-btn-sm"
              onClick={() => {
                x.action!.run();
                dismiss(x.id);
              }}
            >
              {x.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
